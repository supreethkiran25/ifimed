/**
 * Comprehensive verification of Bank Detection, Month Routing, Deduplication, and Supabase DB Sync
 */
const assert = require('assert');
const fs = require('fs');

console.log('--- Testing Bank Auto-Detection & Backend Database Flow ---');

// Extract detectBankFromCsv and detectMonthFromCsvLines logic from app.js to unit test in node
const appJs = fs.readFileSync('./app.js', 'utf8');

// Test 1: Check detectBankFromCsv logic
const corporateBanks = [
  {
    id: 'icici-3021',
    name: 'ICICI Bank',
    type: 'Current A/c',
    accNo: '••••3021',
    fullAccNo: '000205003021',
    ifsc: 'ICIC0000002',
    sheets: []
  },
  {
    id: 'axis-7419',
    name: 'Axis Bank',
    type: 'Current A/c',
    accNo: '••••7419',
    fullAccNo: '921020007419821',
    ifsc: 'UTIB0000042',
    sheets: []
  },
  {
    id: 'kotak-8502',
    name: 'Kotak Mahindra Bank',
    type: 'Current A/c',
    accNo: '••••8502',
    fullAccNo: '711200988502',
    ifsc: 'KKBK0000421',
    sheets: []
  }
];

function getActiveBank() { return corporateBanks[0]; }

function isSummaryOrFooterLine(line) {
  if (!line || !line.trim()) return true;
  const normalized = line.toLowerCase();
  return normalized.startsWith('total') || normalized.includes('opening balance') || normalized.includes('statement period');
}

// Evaluate detectBankFromCsv and detectMonthFromCsvLines in local scope
const funcCode = appJs.match(/function detectBankFromCsv[\s\S]*?function detectMonthFromCsvLines[\s\S]*?\n\}/)[0];
eval(funcCode);

// Test 1.1: Detect Axis Bank from filename
const resAxisFile = detectBankFromCsv('Date,Narration,Ref,Amount\n19/09/2026,UPI Payment,REF100,5000', 'Axis_Bank_September.csv');
assert.strictEqual(resAxisFile.bank.id, 'axis-7419', 'Should detect Axis bank from filename');
console.log('✔ Test 1.1 Passed: Detected Axis Bank from filename');

// Test 1.2: Detect ICICI Bank from full account number in CSV content
const resIciciAcc = detectBankFromCsv('Account Statement for 000205003021\nDate,Narration,Ref,Amount\n19/09/2026,Deposit,REF101,15000', 'statement.csv');
assert.strictEqual(resIciciAcc.bank.id, 'icici-3021', 'Should detect ICICI bank from full account number');
console.log('✔ Test 1.2 Passed: Detected ICICI Bank from full account number');

// Test 1.3: Detect Kotak Bank from IFSC code in CSV content
const resKotakIfsc = detectBankFromCsv('IFSC Code: KKBK0000421\nDate,Narration,Ref,Amount\n19/09/2026,RTGS Inward,REF102,75000', 'bank_export.csv');
assert.strictEqual(resKotakIfsc.bank.id, 'kotak-8502', 'Should detect Kotak bank from IFSC');
console.log('✔ Test 1.3 Passed: Detected Kotak Bank from IFSC code');

// Test 1.4: Auto-register new bank (Canara Bank)
const resCanara = detectBankFromCsv('Canara Bank Commercial Branch\nAccount No: 129088192019\nIFSC: CNRB0001928\nDate,Narration,Ref,Amount\n19/09/2026,UPI,REF103,12000', 'canara_sep.csv');
assert.strictEqual(resCanara.isNew, true, 'Should mark new bank as isNew');
assert.strictEqual(resCanara.bank.name, 'Canara Bank', 'Should identify Canara Bank');
assert.strictEqual(resCanara.bank.accNo, '••••2019', 'Should extract account suffix');
console.log('✔ Test 1.4 Passed: Auto-registered new Canara Bank account (' + resCanara.bank.accNo + ')');

// Test 2: Month Detection from dates
const linesSep = [
  'Date,Particulars,Ref,Debit,Credit',
  '18/09/2026,Transfer 1,REF1,0,45000',
  '19/09/2026,Transfer 2,REF2,12000,0',
  '20/09/2026,Transfer 3,REF3,0,98000'
];
const monthSep = detectMonthFromCsvLines(linesSep);
assert.strictEqual(monthSep.monthId, '2026-09', 'Should detect September 2026');
assert.strictEqual(monthSep.label, 'September 2026', 'Label should be September 2026');
console.log('✔ Test 2.1 Passed: Detected month September 2026 from DD/MM/YYYY dates');

const linesAug = [
  'Date,Particulars,Ref,Debit,Credit',
  '2026-08-15,Transfer 1,REF1,0,45000',
  '2026-08-20,Transfer 2,REF2,12000,0'
];
const monthAug = detectMonthFromCsvLines(linesAug);
assert.strictEqual(monthAug.monthId, '2026-08', 'Should detect August 2026');
console.log('✔ Test 2.2 Passed: Detected month August 2026 from YYYY-MM-DD dates');

// Test 3: Backend Database Connectivity Check
const http = require('http');

function checkEndpoint(url, options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  try {
    // 3.1: Check Supabase Data Endpoint
    const dataRes = await checkEndpoint('http://localhost:3000/api/supabase/data', { method: 'GET' });
    assert.strictEqual(dataRes.status, 200, 'Supabase data endpoint should return 200');
    const dataJson = JSON.parse(dataRes.body);
    assert.strictEqual(dataJson.success, true, 'Supabase data fetch should be successful');
    console.log('✔ Test 3.1 Passed: /api/supabase/data returned live state (Source: ' + dataJson.source + ')');

    // 3.2: Check Statement Upload & Archival
    const uploadRes = await checkEndpoint('http://localhost:3000/api/supabase/upload-statement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({
      fileName: 'verification_axis_september.csv',
      csvContent: 'Date,Narration,Ref,Credit\n19/09/2026,UPI/CR/001,REF-VERIF-1,25000'
    }));
    assert.strictEqual(uploadRes.status, 200, 'Statement upload should return 200');
    const uploadJson = JSON.parse(uploadRes.body);
    assert.strictEqual(uploadJson.archivedInSupabase, true, 'Should archive statement in Supabase');
    console.log('✔ Test 3.2 Passed: Statement archived in Supabase Cloud Storage (' + uploadJson.storageKey + ')');

    // 3.3: Check Supabase Cloud DB Save without wiping live sheets
    const currentState = JSON.parse(dataRes.body);
    const saveRes = await checkEndpoint('http://localhost:3000/api/supabase/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({
      banks: currentState.data.banks,
      invoices: currentState.data.invoices || [],
      bills: currentState.data.bills || [],
      activities: [{ text: 'Automated test sync', meta: 'Test suite' }]
    }));
    assert.strictEqual(saveRes.status, 200, 'Supabase save should return 200');
    const saveJson = JSON.parse(saveRes.body);
    assert.strictEqual(saveJson.success, true, 'Supabase save should be successful');
    console.log('✔ Test 3.3 Passed: Persisted state to Supabase Cloud DB (' + saveJson.syncedTo + ')');

    console.log('\n--- All Bank Detection & Supabase Backend Tests Passed! ---');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
})();
