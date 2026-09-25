const https = require('https');
const { getSupabaseConfig, assertSupabaseConfig } = require('./server-env');

function supabaseRestRequest(endpoint, method = 'GET', data = null, preferUpsert = false) {
  const cfg = assertSupabaseConfig();
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    const headers = {
      apikey: cfg.serviceKey,
      Authorization: 'Bearer ' + cfg.serviceKey,
      'Content-Type': 'application/json'
    };
    if (preferUpsert) {
      headers.Prefer = 'resolution=merge-duplicates,return=representation';
    } else if (method === 'DELETE') {
      headers.Prefer = 'return=minimal';
    }
    if (postData) headers['Content-Length'] = Buffer.byteLength(postData);

    const req = https.request({
      hostname: `${cfg.projectRef}.supabase.co`,
      path: `/rest/v1/${endpoint}`,
      method,
      headers
    }, res => {
      let d = '';
      res.on('data', chunk => { d += chunk; });
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
  const cfg = getSupabaseConfig();
  return new Promise((resolve) => {
    const safeName = storageSafeFileName(fileName);
    if (!safeName || !cfg.projectRef || !cfg.serviceKey) return resolve({ success: false });
    const req = https.request({
      hostname: `${cfg.projectRef}.supabase.co`,
      path: `/storage/v1/object/reconciliation-data/statements/${safeName}`,
      method: 'DELETE',
      headers: {
        apikey: cfg.serviceKey,
        Authorization: 'Bearer ' + cfg.serviceKey
      }
    }, res => {
      let d = '';
      res.on('data', chunk => { d += chunk; });
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

async function upsertInChunks(endpoint, rows, chunkSize = 80) {
  if (!Array.isArray(rows) || !rows.length) return 0;
  let saved = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await supabaseRestRequest(`${endpoint}?on_conflict=id`, 'POST', chunk, true);
    saved += chunk.length;
  }
  return saved;
}

async function saveToSupabaseRestTables(payload) {
  const syncResults = {
    banks: 0,
    invoices: 0,
    bills: 0,
    mappings: 0,
    activities: 0,
    deletedSheets: 0,
    transactions: 0,
    adjustments: 0
  };

  if (Array.isArray(payload.deletedSheets) && payload.deletedSheets.length > 0) {
    for (const del of payload.deletedSheets) {
      const deleted = await deleteStatementSheetFromDb(del);
      if (deleted && deleted.success) syncResults.deletedSheets += 1;
    }
  }

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
      return {
        id: b.id,
        name: b.name || (prev && prev.name) || 'Bank',
        type: b.type || (prev && prev.type) || 'Current A/c',
        acc_no: b.accNo || b.acc_no || (prev && prev.acc_no) || '',
        full_acc_no: b.fullAccNo || b.full_acc_no || (prev && prev.full_acc_no) || null,
        ifsc: b.ifsc || (prev && prev.ifsc) || null,
        branch: b.branch || (prev && prev.branch) || null,
        sheets: mergeBankSheets(prevSheets, incomingSheets, deletedKeys),
        updated_at: new Date().toISOString()
      };
    });

    await supabaseRestRequest('corporate_banks?on_conflict=id', 'POST', bankRows, true);
    syncResults.banks = bankRows.length;
  }

  if (Array.isArray(payload.invoices)) {
    if (payload.invoices.length === 0) {
      try {
        await supabaseRestRequest('invoices?id=neq.placeholder_keep_none', 'DELETE', null, false);
        syncResults.invoices = 0;
      } catch (e) {
        console.warn('Notice: delete all invoices failed:', e.message);
      }
    } else {
      const activeIds = payload.invoices.map(inv => String(inv.id || inv.invoiceNo));
      try {
        const existingInvs = await supabaseRestRequest('invoices?select=id', 'GET', null, false);
        if (Array.isArray(existingInvs)) {
          const toDelete = existingInvs.filter(i => !activeIds.includes(String(i.id)));
          if (toDelete.length > 0) {
            for (let i = 0; i < toDelete.length; i += 80) {
              const chunk = toDelete.slice(i, i + 80).map(i => encodeURIComponent(String(i.id))).join(',');
              await supabaseRestRequest(`invoices?id=in.(${chunk})`, 'DELETE', null, false);
            }
          }
        }
      } catch (e) {}

      syncResults.invoices = await upsertInChunks('invoices', payload.invoices.map(inv => ({
        id: inv.id || inv.invoiceNo,
        invoice_no: inv.invoiceNo,
        guest_name: inv.guestName || inv.customer || 'Customer',
        amount: parseFloat(inv.amount) || 0,
        date: inv.date || '',
        status: inv.status || 'Unpaid',
        settled_amount: parseFloat(inv.settledAmount) || 0
      })));
    }
  }

  if (Array.isArray(payload.bills)) {
    if (payload.bills.length === 0) {
      try {
        await supabaseRestRequest('vendor_bills?id=neq.placeholder_keep_none', 'DELETE', null, false);
        syncResults.bills = 0;
      } catch (e) {}
    } else {
      const activeBillIds = payload.bills.map(b => String(b.id || b.billNo));
      try {
        const existingBills = await supabaseRestRequest('vendor_bills?select=id', 'GET', null, false);
        if (Array.isArray(existingBills)) {
          const toDelete = existingBills.filter(b => !activeBillIds.includes(String(b.id)));
          if (toDelete.length > 0) {
            for (let i = 0; i < toDelete.length; i += 80) {
              const chunk = toDelete.slice(i, i + 80).map(b => encodeURIComponent(String(b.id))).join(',');
              await supabaseRestRequest(`vendor_bills?id=in.(${chunk})`, 'DELETE', null, false);
            }
          }
        }
      } catch (e) {}

      syncResults.bills = await upsertInChunks('vendor_bills', payload.bills.map(b => ({
        id: b.id || b.billNo,
        bill_no: b.billNo,
        vendor_name: b.vendorName || b.vendor || 'Vendor',
        amount: parseFloat(b.amount) || 0,
        date: b.date || '',
        status: b.status || 'Unpaid',
        settled_amount: parseFloat(b.settledAmount) || 0
      })));
    }
  }

  const txnRows = [];
  const pushTxn = (row) => {
    if (!row || !row.id) return;
    txnRows.push({
      id: String(row.id),
      bank_id: row.bank_id,
      month_id: row.month_id || '2026-09',
      transaction_date: row.transaction_date || row.date || '',
      narration: row.narration || 'Bank Transaction',
      payer: row.payer || null,
      bank_ref: row.bank_ref || row.bankRef || row.id || 'REF',
      type: row.type || 'TRANSFER',
      transaction_type: row.transaction_type === 'debit' ? 'debit' : 'credit',
      amount: parseFloat(row.amount) || 0,
      status: row.status || 'unmapped',
      mapping: row.mapping || null
    });
  };

  if (Array.isArray(payload.banks)) {
    payload.banks.forEach(b => {
      (b.sheets || []).forEach(s => {
        (s.records || []).forEach(r => {
          pushTxn({
            id: r.id || `CR-${b.id}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            bank_id: b.id,
            month_id: s.monthId || '2026-09',
            transaction_date: r.date || '',
            narration: r.narration || 'Bank Inflow',
            payer: r.payer || null,
            bank_ref: r.bankRef || r.id || 'REF',
            type: r.type || 'TRANSFER',
            transaction_type: 'credit',
            amount: r.amount,
            status: r.status || 'unmapped',
            mapping: r.mapping || null
          });
        });
        (s.debitRecords || []).forEach(r => {
          pushTxn({
            id: r.id || `DR-${b.id}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            bank_id: b.id,
            month_id: s.monthId || '2026-09',
            transaction_date: r.date || '',
            narration: r.narration || 'Bank Outflow',
            payer: r.payer || null,
            bank_ref: r.bankRef || r.id || 'REF',
            type: r.type || 'TRANSFER',
            transaction_type: 'debit',
            amount: r.amount,
            status: r.status || 'unmapped',
            mapping: r.mapping || null
          });
        });
      });
    });
  }

  if (txnRows.length === 0 && Array.isArray(payload.transactions)) {
    payload.transactions.forEach(pushTxn);
  }

  if (txnRows.length > 0) {
    syncResults.transactions = await upsertInChunks('bank_transactions', txnRows, 80);
  }

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

  if (Array.isArray(payload.adjustments) && payload.adjustments.length > 0) {
    const adjRows = payload.adjustments.map(a => ({
      id: a.id || `ADJ-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      bank_id: a.bankId || a.bank_id || null,
      date: a.date || new Date().toLocaleDateString('en-GB'),
      adjustment_type: a.adjustmentType || a.adjustment_type || 'Adjustment',
      description: a.description || a.reason || '',
      reference: a.reference || null,
      debit_or_credit: a.debitOrCredit || a.debit_or_credit || 'debit',
      amount: parseFloat(a.amount) || 0,
      created_by: a.createdBy || a.created_by || 'Corporate Controller',
      status: a.status || 'Approved',
      created_at: a.createdAt || a.created_at || new Date().toISOString()
    }));
    try {
      syncResults.adjustments = await upsertInChunks('adjustments', adjRows, 80);
    } catch (e) {
      console.warn('Notice: adjustments upsert to Supabase REST (snapshot storage will preserve):', e.message);
    }
  }

  return syncResults;
}

async function fetchSupabaseStateFromRest() {
  const banks = await supabaseRestRequest('corporate_banks?select=*&order=id.asc', 'GET', null, false);
  if (!Array.isArray(banks) || banks.length === 0) return null;

  const formattedBanks = banks.map(b => {
    const rawAcc = String(b.acc_no || '');
    const accCorrupt = /[\uFFFD]/.test(rawAcc) || !/\d{4}/.test(rawAcc);
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
    return {
      id: b.id,
      name: b.name,
      type: b.type,
      accNo,
      fullAccNo: b.full_acc_no,
      ifsc: b.ifsc,
      branch: b.branch,
      sheets: Array.isArray(b.sheets) ? b.sheets : []
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
          if (!bucket.some(r => String(r.id) === String(row.id))) bucket.push(row);
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

  let adjustments = [];
  try {
    const adjData = await supabaseRestRequest('adjustments?select=*&order=created_at.desc', 'GET', null, false);
    if (Array.isArray(adjData)) {
      adjustments = adjData.map(a => ({
        id: a.id,
        bankId: a.bank_id,
        date: a.date,
        adjustmentType: a.adjustment_type,
        description: a.description,
        reference: a.reference,
        debitOrCredit: a.debit_or_credit,
        amount: parseFloat(a.amount) || 0,
        createdBy: a.created_by,
        status: a.status,
        createdAt: a.created_at
      }));
    }
  } catch (e) {
    // Falls back gracefully if table not yet migrated
  }

  return { banks: formattedBanks, invoices, bills, activities, adjustments };
}

function fetchSupabaseStateFromStorage() {
  const cfg = assertSupabaseConfig();
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: `${cfg.projectRef}.supabase.co`,
      path: '/storage/v1/object/public/reconciliation-data/reconciliation_state.json',
      method: 'GET',
      headers: {
        apikey: cfg.serviceKey,
        'Cache-Control': 'no-cache'
      }
    }, res => {
      let d = '';
      res.on('data', chunk => { d += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(d));
          else reject(new Error(`Storage returned ${res.statusCode}: ${d}`));
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
  const cfg = getSupabaseConfig();
  return new Promise((resolve) => {
    if (!cfg.projectRef || !cfg.serviceKey) return resolve({ success: false });
    const postData = JSON.stringify(payload);
    const req = https.request({
      hostname: `${cfg.projectRef}.supabase.co`,
      path: '/storage/v1/object/reconciliation-data/reconciliation_state.json',
      method: 'POST',
      headers: {
        apikey: cfg.serviceKey,
        Authorization: 'Bearer ' + cfg.serviceKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'x-upsert': 'true'
      }
    }, res => {
      let d = '';
      res.on('data', chunk => { d += chunk; });
      res.on('end', () => resolve({ success: res.statusCode >= 200 && res.statusCode < 300 }));
    });
    req.on('error', () => resolve({ success: false }));
    req.write(postData);
    req.end();
  });
}

function uploadRawStatementToSupabase(fileName, content) {
  const cfg = assertSupabaseConfig();
  return new Promise((resolve, reject) => {
    const safeName = storageSafeFileName(fileName || `statement_${Date.now()}.csv`);
    const body = Buffer.from(String(content || ''), 'utf8');
    const req = https.request({
      hostname: `${cfg.projectRef}.supabase.co`,
      path: `/storage/v1/object/reconciliation-data/statements/${safeName}`,
      method: 'POST',
      headers: {
        apikey: cfg.serviceKey,
        Authorization: 'Bearer ' + cfg.serviceKey,
        'Content-Type': 'text/csv',
        'Content-Length': body.length,
        'x-upsert': 'true'
      }
    }, res => {
      let d = '';
      res.on('data', chunk => { d += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, fileName: safeName, key: `statements/${safeName}` });
        } else {
          resolve({ success: false, error: d });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = {
  supabaseRestRequest,
  deleteStatementSheetFromDb,
  saveToSupabaseRestTables,
  fetchSupabaseStateFromRest,
  fetchSupabaseStateFromStorage,
  saveSupabaseStorageSnapshot,
  uploadRawStatementToSupabase
};
