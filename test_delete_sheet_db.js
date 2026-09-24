const http = require('http');

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path,
      method,
      headers: Object.assign({
        'Content-Type': 'application/json'
      }, payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(d); } catch (e) {}
        resolve({ status: res.statusCode, json, raw: d.slice(0, 400) });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(async () => {
  const bankId = 'test-delete-sheet-9999';
  const monthId = '2026-01';
  const txnId = 'CR-TEST-DELETE-9999';

  const save = await request('POST', '/api/supabase/save', {
    banks: [{
      id: bankId,
      name: 'Test Delete Bank',
      type: 'Current A/c',
      accNo: '••••9999',
      fullAccNo: '999999999999',
      ifsc: 'TEST0009999',
      branch: 'Test',
      sheets: [{
        monthId,
        label: 'January 2026',
        fileName: 'test_delete_sheet.csv',
        uploadedOn: '24 Sep 2026',
        creditsCount: 1,
        debitsCount: 0,
        records: [{
          id: txnId,
          date: '05/01/2026',
          narration: 'TEST DELETE ROW',
          payer: 'Tester',
          type: 'UPI',
          bankRef: 'TEST-REF',
          amount: 10,
          status: 'unmapped',
          mapping: null
        }],
        debitRecords: []
      }]
    }],
    invoices: [],
    bills: [],
    activities: [],
    deletedSheets: []
  });
  assert(save.status === 200 && save.json && save.json.success, 'seed save failed');

  const before = await request('GET', '/api/supabase/data');
  const beforeBank = (before.json.data.banks || []).find(b => b.id === bankId);
  assert(beforeBank && (beforeBank.sheets || []).some(s => s.monthId === monthId), 'seeded sheet missing before delete');

  const del = await request('POST', '/api/supabase/delete-sheet', {
    bankId,
    monthId,
    txnIds: [txnId],
    fileName: 'test_delete_sheet.csv'
  });
  assert(del.status === 200 && del.json && del.json.success, 'delete-sheet API failed: ' + del.raw);

  const after = await request('GET', '/api/supabase/data');
  const afterBank = (after.json.data.banks || []).find(b => b.id === bankId);
  const stillThere = afterBank && (afterBank.sheets || []).some(s => s.monthId === monthId);
  assert(!stillThere, 'deleted sheet is still present in the database');

  await request('POST', '/api/supabase/save', {
    banks: [{
      id: bankId,
      name: 'Test Delete Bank',
      type: 'Current A/c',
      accNo: '••••9999',
      fullAccNo: '999999999999',
      sheets: []
    }],
    deletedSheets: [{ bankId, monthId, txnIds: [txnId] }]
  });

  const cleanup = await request('POST', '/api/supabase/delete-sheet', {
    bankId,
    monthId,
    txnIds: [txnId],
    fileName: 'test_delete_sheet.csv',
    removeBankIfEmpty: true
  });
  assert(cleanup.status === 200, 'cleanup delete failed');

  console.log('✔ Frontend delete now removes the sheet and transactions from Supabase');
})().catch(err => {
  console.error('✖', err.message);
  process.exit(1);
});
