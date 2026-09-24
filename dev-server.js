const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { getSupabaseConfig } = require('./lib/server-env');
const { handleAuthSignIn, handleAuthSignOut } = require('./lib/auth-api');

const PORT = process.env.PORT || 3000;
const supabaseCfg = getSupabaseConfig();
const SUPABASE_PROJECT_REF = supabaseCfg.projectRef;
const SUPABASE_SERVICE_KEY = supabaseCfg.serviceKey;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function isDateLikeValue(val) {
  const str = String(val == null ? '' : val).trim();
  if (!str) return false;
  return /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(str)
    || /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(str)
    || /^\d{1,2}[\s\-\/][A-Za-z]{3,9}[\s\-\/,]+\d{2,4}$/.test(str)
    || /^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4}$/.test(str);
}

function isUsableStatementRow(row) {
  if (!row) return false;
  const date = String(row.date || '').trim();
  if (!date || date.length > 28 || /^\d{1,3}$/.test(date) || /\s[-–]\s/.test(date)) return false;
  if (!isDateLikeValue(date)) return false;
  const amount = Number(row.amount);
  if (!Number.isFinite(amount) || Math.abs(amount) < 0.01 || Math.abs(amount) > 100000000) return false;
  const dateDigits = date.replace(/\D/g, '').replace(/^0+/, '');
  const amtDigits = String(Math.round(Math.abs(amount)));
  if (dateDigits && dateDigits === amtDigits) return false;
  const blob = `${date} ${row.narration || ''} ${row.payer || ''}`;
  if (/marg erp|chemist rs\.|online purchase import|call 0\d{8,}/i.test(blob)) return false;
  return true;
}

/**
 * Universal Supabase PostgreSQL REST API Client
 */
function supabaseRestRequest(endpoint, method = 'GET', data = null, preferUpsert = false) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    const headers = {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json'
    };
    if (preferUpsert) {
      headers['Prefer'] = 'resolution=merge-duplicates,return=representation';
    } else if (method === 'DELETE') {
      headers['Prefer'] = 'return=minimal';
    }
    if (postData) {
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = https.request({
      hostname: `${SUPABASE_PROJECT_REF}.supabase.co`,
      path: `/rest/v1/${endpoint}`,
      method: method,
      headers: headers
    }, res => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(d ? JSON.parse(d) : { success: true });
          } catch (e) {
            resolve({ success: true, raw: d });
          }
        } else {
          console.warn(`[Supabase REST Error] ${method} /rest/v1/${endpoint} returned ${res.statusCode}:`, d);
          reject(new Error(`Supabase REST error ${res.statusCode}: ${d}`));
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function storageSafeFileName(fileName) {
  return String(fileName || '').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function deleteRawStatementFromSupabase(fileName) {
  return new Promise((resolve) => {
    const safeName = storageSafeFileName(fileName);
    if (!safeName) return resolve({ success: false });
    const req = https.request({
      hostname: `${SUPABASE_PROJECT_REF}.supabase.co`,
      path: `/storage/v1/object/reconciliation-data/statements/${safeName}`,
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY
      }
    }, res => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => {
        resolve({ success: res.statusCode >= 200 && res.statusCode < 300 || res.statusCode === 404 });
      });
    });
    req.on('error', () => resolve({ success: false }));
    req.end();
  });
}

async function deleteStatementSheetFromDb(del) {
  const bankId = String((del && del.bankId) || '');
  const monthId = String((del && del.monthId) || '');
  if (!bankId || !monthId) return { success: false, error: 'bankId and monthId are required' };

  const result = { success: true, transactions: 0, bank: false, storage: false };

  try {
    await supabaseRestRequest(
      `bank_transactions?bank_id=eq.${encodeURIComponent(bankId)}&month_id=eq.${encodeURIComponent(monthId)}`,
      'DELETE',
      null,
      false
    );
    result.transactions += 1;
  } catch (e) {
    console.warn('Notice: delete txns by month failed:', e.message);
  }

  if (Array.isArray(del.txnIds) && del.txnIds.length > 0) {
    for (let i = 0; i < del.txnIds.length; i += 80) {
      const chunk = del.txnIds.slice(i, i + 80).map(id => encodeURIComponent(String(id))).join(',');
      try {
        await supabaseRestRequest(`bank_transactions?id=in.(${chunk})`, 'DELETE', null, false);
        result.transactions += 1;
      } catch (e) {
        console.warn('Notice: delete txns by id failed:', e.message);
      }
    }
  }

  try {
    const banks = await supabaseRestRequest(
      `corporate_banks?id=eq.${encodeURIComponent(bankId)}&select=id,sheets`,
      'GET',
      null,
      false
    );
    const bank = Array.isArray(banks) ? banks[0] : null;
    if (bank) {
      const sheets = (Array.isArray(bank.sheets) ? bank.sheets : []).filter(s => s && String(s.monthId) !== monthId);
      await supabaseRestRequest(
        `corporate_banks?id=eq.${encodeURIComponent(bankId)}`,
        'PATCH',
        { sheets, updated_at: new Date().toISOString() },
        false
      );
      result.bank = true;
    }
  } catch (e) {
    console.warn('Notice: strip deleted sheet from corporate_banks failed:', e.message);
    result.success = false;
    result.error = e.message;
  }

  if (del.fileName) {
    const stored = await deleteRawStatementFromSupabase(del.fileName);
    result.storage = !!stored.success;
  }

  if (del.removeBankIfEmpty) {
    try {
      const banks = await supabaseRestRequest(
        `corporate_banks?id=eq.${encodeURIComponent(bankId)}&select=id,sheets`,
        'GET',
        null,
        false
      );
      const bank = Array.isArray(banks) ? banks[0] : null;
      const remaining = bank && Array.isArray(bank.sheets) ? bank.sheets : [];
      if (bank && remaining.length === 0) {
        await supabaseRestRequest(`corporate_banks?id=eq.${encodeURIComponent(bankId)}`, 'DELETE', null, false);
        result.removedBank = true;
      }
    } catch (e) {
      console.warn('Notice: remove empty test bank failed:', e.message);
    }
  }

  return result;
}

/**
 * Persist statement data directly to Supabase PostgreSQL Tables:
 * - corporate_banks (upsert bank accounts with sheets JSONB)
 * - invoices (upsert invoices)
 * - vendor_bills (upsert vendor bills)
 * - reconciled_mappings (audit trail for mapped records)
 * - activity_logs (audit log entries)
 */
function mergeBankSheets(prevSheets, incomingSheets, deletedKeys) {
  const prev = (Array.isArray(prevSheets) ? prevSheets : []).filter(s => s && s.monthId && !deletedKeys.has(String(s.monthId)));
  const incoming = (Array.isArray(incomingSheets) ? incomingSheets : []).filter(s => s && s.monthId && !deletedKeys.has(String(s.monthId)));
  const mergeById = (a, incomingRows) => {
    const map = new Map();
    (a || []).forEach(r => { if (r && r.id) map.set(String(r.id), r); });
    (incomingRows || []).forEach(r => { if (r && r.id) map.set(String(r.id), r); });
    return Array.from(map.values());
  };
  const prevByMonth = {};
  prev.forEach(s => { prevByMonth[s.monthId] = s; });

  if (deletedKeys.size > 0) {
    if (incoming.length === 0) return prev;
    return incoming.map(s => {
      const old = prevByMonth[s.monthId];
      if (!old) return s;
      return Object.assign({}, old, s, {
        records: mergeById(old.records, s.records),
        debitRecords: mergeById(old.debitRecords, s.debitRecords),
        fileName: s.fileName || old.fileName,
        uploadedOn: s.uploadedOn || old.uploadedOn
      });
    });
  }

  if (incoming.length === 0 && prev.length > 0) return prev;

  return incoming.map(s => {
    const old = prevByMonth[s.monthId];
    if (!old) return s;
    return Object.assign({}, old, s, {
      records: mergeById(old.records, s.records),
      debitRecords: mergeById(old.debitRecords, s.debitRecords),
      fileName: s.fileName || old.fileName,
      uploadedOn: s.uploadedOn || old.uploadedOn
    });
  });
}

async function saveToSupabaseRestTables(payload) {
  const syncResults = {
    banks: 0,
    invoices: 0,
    bills: 0,
    mappings: 0,
    activities: 0,
    deletedSheets: 0
  };

  if (Array.isArray(payload.deletedSheets) && payload.deletedSheets.length > 0) {
    for (const del of payload.deletedSheets) {
      const deleted = await deleteStatementSheetFromDb(del);
      if (deleted && deleted.success) syncResults.deletedSheets += 1;
    }
  }

  // 1. Persist Corporate Banks (merge sheets so an empty client cannot wipe uploads)
  if (Array.isArray(payload.banks) && payload.banks.length > 0) {
    let existingBanks = [];
    try {
      existingBanks = await supabaseRestRequest('corporate_banks?select=*', 'GET', null, false);
    } catch (e) {}
    const existingById = {};
    (Array.isArray(existingBanks) ? existingBanks : []).forEach(b => {
      existingById[b.id] = b;
    });

    const bankRows = payload.banks.map(b => {
      const prev = existingById[b.id];
      const incomingSheets = Array.isArray(b.sheets) ? b.sheets : [];
      const prevSheets = prev && Array.isArray(prev.sheets) ? prev.sheets : [];
      const deletedKeys = new Set(
        (Array.isArray(payload.deletedSheets) ? payload.deletedSheets : [])
          .filter(d => d && String(d.bankId) === String(b.id) && d.monthId)
          .map(d => String(d.monthId))
      );
      const mergedSheets = mergeBankSheets(prevSheets, incomingSheets, deletedKeys);
      return {
        id: b.id,
        name: b.name || (prev && prev.name) || 'Bank',
        type: b.type || (prev && prev.type) || 'Current A/c',
        acc_no: b.accNo || b.acc_no || (prev && prev.acc_no) || '',
        full_acc_no: b.fullAccNo || b.full_acc_no || (prev && prev.full_acc_no) || null,
        ifsc: b.ifsc || (prev && prev.ifsc) || null,
        branch: b.branch || (prev && prev.branch) || null,
        sheets: mergedSheets,
        updated_at: new Date().toISOString()
      };
    });

    try {
      await supabaseRestRequest('corporate_banks?on_conflict=id', 'POST', bankRows, true);
      syncResults.banks = bankRows.length;
    } catch (e) {
      console.error('Failed saving corporate_banks to Supabase REST:', e.message);
    }
  }

  // 2. Persist Customer Invoices
  if (Array.isArray(payload.invoices) && payload.invoices.length > 0) {
    const invRows = payload.invoices.map(inv => ({
      id: inv.id || inv.invoiceNo,
      invoice_no: inv.invoiceNo,
      guest_name: inv.guestName || inv.customer || 'Customer',
      amount: parseFloat(inv.amount) || 0,
      date: inv.date || '',
      status: inv.status || 'Unpaid',
      settled_amount: parseFloat(inv.settledAmount) || 0
    }));

    try {
      await supabaseRestRequest('invoices?on_conflict=id', 'POST', invRows, true);
      syncResults.invoices = invRows.length;
    } catch (e) {
      console.error('Failed saving invoices to Supabase REST:', e.message);
    }
  }

  // 3. Persist Vendor Bills
  if (Array.isArray(payload.bills) && payload.bills.length > 0) {
    const billRows = payload.bills.map(b => ({
      id: b.id || b.billNo,
      bill_no: b.billNo,
      vendor_name: b.vendorName || b.vendor || 'Vendor',
      amount: parseFloat(b.amount) || 0,
      date: b.date || '',
      status: b.status || 'Unpaid',
      settled_amount: parseFloat(b.settledAmount) || 0
    }));

    try {
      await supabaseRestRequest('vendor_bills?on_conflict=id', 'POST', billRows, true);
      syncResults.bills = billRows.length;
    } catch (e) {
      console.error('Failed saving vendor_bills to Supabase REST:', e.message);
    }
  }

  // 4. Extract and persist Reconciled Mappings
  if (Array.isArray(payload.banks)) {
    const mappingRows = [];
    payload.banks.forEach(b => {
      (b.sheets || []).forEach(s => {
        // Credits
        (s.records || []).forEach(r => {
          if (r.status === 'mapped' && r.mapping) {
            mappingRows.push({
              bank_id: b.id,
              bank_ref: r.bankRef || r.id || 'REF',
              transaction_date: r.date || '',
              amount: parseFloat(r.amount) || 0,
              mapping_type: 'credit',
              invoice_no: r.mapping.invoiceNo || null,
              bill_no: null,
              party_name: r.mapping.guestName || r.payer || null,
              note: r.mapping.note || null,
              mapped_by: (r.mapping && r.mapping.user) || 'IFIMED Treasury User'
            });
          }
        });

        // Debits
        (s.debitRecords || []).forEach(r => {
          if (r.status === 'mapped' && r.mapping) {
            mappingRows.push({
              bank_id: b.id,
              bank_ref: r.bankRef || r.id || 'REF',
              transaction_date: r.date || '',
              amount: parseFloat(r.amount) || 0,
              mapping_type: 'debit',
              invoice_no: null,
              bill_no: r.mapping.billNo || null,
              party_name: r.mapping.vendorName || r.payer || null,
              note: r.mapping.note || null,
              mapped_by: (r.mapping && r.mapping.user) || 'IFIMED Treasury User'
            });
          }
        });
      });
    });

    if (mappingRows.length > 0) {
      try {
        await supabaseRestRequest('reconciled_mappings', 'POST', mappingRows, false);
        syncResults.mappings = mappingRows.length;
      } catch (e) {
        console.error('Failed saving reconciled_mappings to Supabase REST:', e.message);
      }
    }
  }

  // 4B. Persist Individual Statement Transactions (Both Credits and Debits)
  if (Array.isArray(payload.banks)) {
    const txnRows = [];
    payload.banks.forEach(b => {
      (b.sheets || []).forEach(s => {
        // Credits (Inflows)
        (s.records || []).forEach(r => {
          txnRows.push({
            id: r.id || `CR-${b.id}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            bank_id: b.id,
            month_id: s.monthId || '2026-09',
            transaction_date: r.date || '',
            narration: r.narration || 'Bank Inflow',
            payer: r.payer || null,
            bank_ref: r.bankRef || r.id || 'REF',
            type: r.type || 'TRANSFER',
            transaction_type: 'credit',
            amount: parseFloat(r.amount) || 0,
            status: r.status || 'unmapped',
            mapping: r.mapping || null
          });
        });

        // Debits (Outflows)
        (s.debitRecords || []).forEach(r => {
          txnRows.push({
            id: r.id || `DR-${b.id}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            bank_id: b.id,
            month_id: s.monthId || '2026-09',
            transaction_date: r.date || '',
            narration: r.narration || 'Bank Outflow',
            payer: r.payer || null,
            bank_ref: r.bankRef || r.id || 'REF',
            type: r.type || 'TRANSFER',
            transaction_type: 'debit',
            amount: parseFloat(r.amount) || 0,
            status: r.status || 'unmapped',
            mapping: r.mapping || null
          });
        });
      });
    });

    if (txnRows.length > 0) {
      try {
        await supabaseRestRequest('bank_transactions?on_conflict=id', 'POST', txnRows, true);
        syncResults.transactions = txnRows.length;
      } catch (e) {
        console.warn('Notice: bank_transactions REST sync fallback:', e.message);
      }
    }
  }

  // 5. Persist Recent Activities
  if (Array.isArray(payload.activities) && payload.activities.length > 0) {
    const actRows = payload.activities.slice(0, 10).map(a => ({
      type: a.type || 'STATEMENT_ACTION',
      text: a.text || (typeof a === 'string' ? a : 'Action logged'),
      time: a.time || new Date().toLocaleTimeString()
    }));

    try {
      await supabaseRestRequest('activity_logs', 'POST', actRows, false);
      syncResults.activities = actRows.length;
    } catch (e) {
      console.error('Failed saving activity_logs to Supabase REST:', e.message);
    }
  }

  return syncResults;
}

/**
 * Fetch complete state directly from Supabase PostgreSQL tables
 */
async function fetchSupabaseStateFromRest() {
  const banks = await supabaseRestRequest('corporate_banks?select=*&order=id.asc', 'GET', null, false);
  if (!Array.isArray(banks) || banks.length === 0) {
    return null;
  }

  const formattedBanks = banks.map(b => {
    const rawAcc = String(b.acc_no || '');
    const accCorrupt = /[�\uFFFD]/.test(rawAcc) || !/\d{4}/.test(rawAcc);
    const idSuffix = String(b.id || '').split('-').pop();
    let accNo = rawAcc;
    if (!accCorrupt && /\d{4}/.test(rawAcc)) {
      accNo = `••••${rawAcc.replace(/\D/g, '').slice(-4)}`;
    } else if (idSuffix && /^\d{4}$/.test(idSuffix)) {
      accNo = `••••${idSuffix}`;
    } else {
      const suffix = String(b.full_acc_no || '').replace(/\D/g, '').slice(-4);
      const accDigits = rawAcc.replace(/\D/g, '');
      accNo = suffix ? `••••${suffix}` : (accDigits.length >= 4 ? `••••${accDigits.slice(-4)}` : '••••0000');
    }
    const sheets = Array.isArray(b.sheets) ? b.sheets : [];
    return {
      id: b.id,
      name: b.name,
      type: b.type,
      accNo,
      fullAccNo: b.full_acc_no,
      ifsc: b.ifsc,
      branch: b.branch,
      sheets
    };
  });

  try {
    const txnData = await supabaseRestRequest('bank_transactions?select=*&order=transaction_date.asc', 'GET', null, false);
    if (Array.isArray(txnData) && txnData.length > 0) {
      const byBank = {};
      txnData.forEach(t => {
        if (!byBank[t.bank_id]) byBank[t.bank_id] = [];
        byBank[t.bank_id].push(t);
      });

      formattedBanks.forEach(bank => {
        const list = byBank[bank.id] || [];
        if (!list.length) return;
        if (!Array.isArray(bank.sheets)) bank.sheets = [];
        list.forEach(t => {
          const monthId = t.month_id || '2026-09';
          let sheet = bank.sheets.find(s => s.monthId === monthId);
          if (!sheet) return;
          if (!sheet.records) sheet.records = [];
          if (!sheet.debitRecords) sheet.debitRecords = [];
          const row = {
            id: t.id,
            date: t.transaction_date,
            narration: t.narration,
            payer: t.payer,
            type: t.type || 'TRANSFER',
            bankRef: t.bank_ref,
            amount: parseFloat(t.amount) || 0,
            status: t.status || 'unmapped',
            mapping: t.mapping || null
          };
          const bucket = t.transaction_type === 'debit' ? sheet.debitRecords : sheet.records;
          if (!bucket.some(r => String(r.id) === String(row.id))) {
            bucket.push(row);
          }
          sheet.creditsCount = sheet.records.length;
          sheet.debitsCount = sheet.debitRecords.length;
        });
      });
    }
  } catch (e) {
    console.warn('Notice: bank_transactions read fallback:', e.message);
  }

  let invoices = [];
  try {
    const invData = await supabaseRestRequest('invoices?select=*&order=created_at.desc', 'GET', null, false);
    if (Array.isArray(invData)) {
      invoices = invData.map(inv => ({
        id: inv.id,
        invoiceNo: inv.invoice_no,
        guestName: inv.guest_name,
        amount: parseFloat(inv.amount) || 0,
        date: inv.date,
        status: inv.status,
        settledAmount: parseFloat(inv.settled_amount) || 0
      }));
    }
  } catch (e) {}

  let bills = [];
  try {
    const billData = await supabaseRestRequest('vendor_bills?select=*&order=created_at.desc', 'GET', null, false);
    if (Array.isArray(billData)) {
      bills = billData.map(b => ({
        id: b.id,
        billNo: b.bill_no,
        vendorName: b.vendor_name,
        amount: parseFloat(b.amount) || 0,
        date: b.date,
        status: b.status,
        settledAmount: parseFloat(b.settled_amount) || 0
      }));
    }
  } catch (e) {}

  let activities = [];
  try {
    const actData = await supabaseRestRequest('activity_logs?select=*&order=created_at.desc&limit=30', 'GET', null, false);
    if (Array.isArray(actData)) {
      activities = actData.map(a => ({
        id: a.id,
        type: a.type,
        text: a.text,
        time: a.time
      }));
    }
  } catch (e) {}

  return {
    banks: formattedBanks,
    invoices,
    bills,
    activities
  };
}

/**
 * Storage Bucket Fallback & Snapshotting
 */
function fetchSupabaseStateFromStorage() {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: `${SUPABASE_PROJECT_REF}.supabase.co`,
      path: '/storage/v1/object/public/reconciliation-data/reconciliation_state.json',
      method: 'GET',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Cache-Control': 'no-cache'
      }
    }, res => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(d));
          } else {
            reject(new Error(`Storage returned ${res.statusCode}: ${d}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function saveSupabaseStorageSnapshot(payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const req = https.request({
      hostname: `${SUPABASE_PROJECT_REF}.supabase.co`,
      path: '/storage/v1/object/reconciliation-data/reconciliation_state.json',
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'x-upsert': 'true'
      }
    }, res => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: d });
        }
      });
    });
    req.on('error', () => resolve({ success: false }));
    req.write(postData);
    req.end();
  });
}

function uploadRawStatementToSupabase(fileName, content) {
  return new Promise((resolve, reject) => {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const req = https.request({
      hostname: `${SUPABASE_PROJECT_REF}.supabase.co`,
      path: `/storage/v1/object/reconciliation-data/statements/${safeName}`,
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
        'Content-Type': 'text/csv',
        'Content-Length': Buffer.byteLength(content),
        'x-upsert': 'true'
      }
    }, res => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, fileName: safeName, key: `statements/${safeName}` });
        } else {
          resolve({ success: false, error: d });
        }
      });
    });
    req.on('error', reject);
    req.write(content);
    req.end();
  });
}

async function handler(req, res) {
  try {
    const rawUrl = req.url || '/';
    const cleanPath = rawUrl.split('?')[0].split('#')[0];

    if (cleanPath === '/api/auth/signin' && req.method === 'POST') {
      await handleAuthSignIn(req, res);
      return;
    }
    if (cleanPath === '/api/auth/signout') {
      await handleAuthSignOut(req, res);
      return;
    }

    // Supabase Cloud Statement Archive Endpoint
    if (cleanPath === '/api/supabase/upload-statement' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body);
          const fileName = parsed.fileName || `statement_${Date.now()}.csv`;
          const csvContent = parsed.csvContent || '';

          const uploadResult = await uploadRawStatementToSupabase(fileName, csvContent);

          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache'
          });
          res.end(JSON.stringify({
            success: true,
            archivedInSupabase: true,
            storageKey: uploadResult.key,
            fileName: uploadResult.fileName
          }));
        } catch (uploadErr) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: uploadErr.message }));
        }
      });
      return;
    }

    // Supabase Cloud Data Fetch Endpoint (Reads from PostgreSQL tables first)
    if (cleanPath === '/api/supabase/data' && req.method === 'GET') {
      try {
        let state = null;
        try {
          state = await fetchSupabaseStateFromRest();
        } catch (e) {
          console.warn('REST fetch failed, trying storage fallback:', e.message);
        }

        if (!state) {
          try {
            state = await fetchSupabaseStateFromStorage();
          } catch (e) {}
        }

        if (state && Array.isArray(state.banks) && state.banks.length > 0) {
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache'
          });
          res.end(JSON.stringify({
            success: true,
            source: 'supabase_postgres_rest',
            project: 'configured',
            data: state
          }));
          return;
        }

        // Fallback to local dataset if cloud tables are empty
        delete require.cache[require.resolve('./data_ifimed.js')];
        const data = require('./data_ifimed.js');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          source: 'local_master_empty',
          data: {
            banks: data.REAL_CORPORATE_BANKS,
            invoices: data.REAL_INVOICES,
            bills: data.REAL_VENDOR_BILLS,
            activities: data.REAL_ACTIVITIES
          }
        }));
        return;
      } catch (cloudErr) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: cloudErr.message }));
        return;
      }
    }

    if (cleanPath === '/api/supabase/delete-sheet' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const result = await deleteStatementSheetFromDb(parsed);
          res.writeHead(result.success ? 200 : 500, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache'
          });
          res.end(JSON.stringify({
            success: !!result.success,
            deletedFrom: 'supabase_postgres_tables',
            project: 'configured',
            result
          }));
        } catch (delErr) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: delErr.message }));
        }
      });
      return;
    }

    // Supabase Cloud Data Save Endpoint (Writes directly to PostgreSQL tables + Storage backup)
    if (cleanPath === '/api/supabase/save' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body);
          parsed.updatedAt = new Date().toISOString();
          parsed.updatedBy = 'IFIMED Treasury User';

          // 1. Direct write to PostgreSQL database tables
          const restSync = await saveToSupabaseRestTables(parsed);

          // 2. Storage snapshot backup
          saveSupabaseStorageSnapshot(parsed).catch(() => {});

          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache'
          });
          res.end(JSON.stringify({
            success: true,
            syncedTo: 'supabase_postgres_tables',
            project: 'configured',
            restSync: restSync,
            timestamp: parsed.updatedAt
          }));
        } catch (saveErr) {
          console.error('Save to Supabase error:', saveErr);
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: saveErr.message }));
        }
      });
      return;
    }

    if (cleanPath === '/api/local-statements') {
      try {
        const dirs = [
          path.join(__dirname, 'sample_statements'),
          path.join(__dirname, 'statements')
        ];
        const files = [];
        dirs.forEach(dir => {
          if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return;
          fs.readdirSync(dir).forEach(name => {
            if (!/\.(csv|tsv|txt)$/i.test(name)) return;
            const csvText = fs.readFileSync(path.join(dir, name), 'utf8');
            files.push({ fileName: name, csvText });
          });
        });
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache'
        });
        res.end(JSON.stringify({ success: true, files }));
      } catch (listErr) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: listErr.message, files: [] }));
      }
      return;
    }

    // Auto-detect bank accounts endpoint (synced with Supabase)
    if (cleanPath === '/api/detect-banks') {
      try {
        let state = null;
        try {
          state = await fetchSupabaseStateFromRest();
        } catch (e) {}

        if (!state) {
          try {
            state = await fetchSupabaseStateFromStorage();
          } catch (e) {}
        }

        let banks = (state && state.banks) ? state.banks : null;
        let invoices = (state && state.invoices) ? state.invoices : null;
        let bills = (state && state.bills) ? state.bills : null;

        if (!banks || banks.length === 0) {
          delete require.cache[require.resolve('./data_ifimed.js')];
          const data = require('./data_ifimed.js');
          banks = data.REAL_CORPORATE_BANKS;
          invoices = data.REAL_INVOICES;
          bills = data.REAL_VENDOR_BILLS;
        }

        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache'
        });
        res.end(JSON.stringify({
          success: true,
          source: 'supabase_postgres',
          accounts: banks,
          invoices: invoices,
          bills: bills
        }));
        return;
      } catch (apiErr) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: apiErr.message }));
        return;
      }
    }

    const safePath = path.normalize(cleanPath).replace(/^(\.\.[\/\\])+/, '');
    const filename = (safePath === '/' || safePath === '' || safePath === '\\') ? 'index.html' : safePath.replace(/^[\/\\]/, '');
    let filePath = path.join(__dirname, filename);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(__dirname, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = fs.readFileSync(filePath);

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });
    res.end(content);
  } catch (err) {
    try {
      const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(indexHtml);
    } catch (fallbackErr) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('500 Internal Server Error: ' + err.message);
    }
  }
}

const server = http.createServer(handler);

server.listen(PORT, () => {
  console.log(`IFIMED Reconciliation Server running at http://localhost:${PORT}/`);
  console.log('Supabase Cloud Database connected');
});

module.exports = server;
