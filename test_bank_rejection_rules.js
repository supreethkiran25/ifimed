/**
 * Comprehensive Validation Test Suite: Bank Statement Matching & Rejection Rules
 *
 * Verifies:
 * 1. UI: Auto-detect buttons are completely removed from index.html.
 * 2. Active Bank Desk Match:
 *    - Matching statement (Axis statement on Axis desk) -> ACCEPTED.
 * 3. Active Bank Desk Mismatch:
 *    - Axis statement uploaded on ICICI desk -> REJECTED (desk mismatch) with switch recommendation.
 *    - ICICI statement uploaded on Kotak desk -> REJECTED (desk mismatch) with switch recommendation.
 * 4. Unregistered Bank:
 *    - Canara Bank statement uploaded -> REJECTED (unregistered bank) with "+ Add Bank Account" recommendation.
 *    - HDFC Bank statement uploaded -> REJECTED (unregistered bank).
 * 5. Account Number Mismatch:
 *    - Statement with unregistered account number -> REJECTED.
 * 6. IFSC Code Mismatch:
 *    - Statement with conflicting IFSC code -> REJECTED.
 * 7. Unverified Statement:
 *    - CSV without bank identifiers -> REJECTED with unverified reason.
 * 8. Zero Auto-Registration:
 *    - detectBankFromCsv does not push new banks to corporateBanks.
 *    - autoDetectBankAccounts is disabled.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Running Bank Statement Verification & Rejection Test Suite ---');

// 1. Verify index.html does not contain auto-detect buttons
console.log('\n[Test 1] Checking index.html for removal of Auto-Detect buttons...');
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
assert(!indexHtml.includes('id="autoDetectBanksBtn"'), 'autoDetectBanksBtn must be removed from index.html');
assert(!indexHtml.includes('id="detectStatementsBtn"'), 'detectStatementsBtn must be removed from index.html');
assert(!indexHtml.toLowerCase().includes('auto-detect accounts'), 'Auto-detect accounts text must be removed from index.html');
assert(indexHtml.includes('id="statementRejectionModal"'), 'statementRejectionModal must exist in index.html');
assert(indexHtml.includes('id="rejectionDismissBtn"'), 'rejectionDismissBtn must exist in index.html');
assert(indexHtml.includes('id="rejectionActionBtn"'), 'rejectionActionBtn must exist in index.html');
console.log('✔ index.html verified: Auto-detect buttons removed & Rejection modal present.');

// Load app.js into a sandbox or mock environment to test the validation functions
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

// Mock browser environment
const mockDOM = {};
const mockWindow = {
  localStorage: {
    getItem: () => null,
    setItem: () => {}
  }
};

const context = {
  window: mockWindow,
  document: {
    getElementById: (id) => ({
      id,
      style: {},
      classList: { add: () => {}, remove: () => {}, toggle: () => {} },
      addEventListener: () => {},
      setAttribute: () => {},
      removeAttribute: () => {},
      value: ''
    }),
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {}
  },
  navigator: {},
  location: { hash: '', search: '', pathname: '/' },
  fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
  setTimeout: (fn) => setTimeout(fn, 0),
  clearTimeout: () => {},
  console: console,
  REAL_CORPORATE_BANKS: [
    {
      id: 'icici-3021',
      name: 'ICICI Bank',
      type: 'Current A/c',
      accNo: '••••3021',
      fullAccNo: '000205003021',
      ifsc: 'ICIC0000002',
      branch: 'Mysore Main Branch, Karnataka',
      sheets: []
    },
    {
      id: 'axis-7419',
      name: 'Axis Bank',
      type: 'Current A/c',
      accNo: '••••7419',
      fullAccNo: '921020007419821',
      ifsc: 'UTIB0000042',
      branch: 'Saraswathipuram, Mysore',
      sheets: []
    },
    {
      id: 'kotak-8502',
      name: 'Kotak Mahindra Bank',
      type: 'Current A/c',
      accNo: '••••8502',
      fullAccNo: '711200988502',
      ifsc: 'KKBK0000421',
      branch: 'Devaraj Urs Road, Mysore',
      sheets: []
    }
  ]
};

const vm = require('vm');
vm.createContext(context);
vm.runInContext(appJs, context);

const validateStatement = context.window.validateStatementMatchesSavedBank;
const detectBank = context.detectBankFromCsv;
const corporateBanks = context.corporateBanks;

assert(typeof validateStatement === 'function', 'validateStatementMatchesSavedBank must be defined');
assert(typeof detectBank === 'function', 'detectBankFromCsv must be defined');

const axisCsv = fs.readFileSync(path.join(__dirname, 'sample_statements', 'Axis_Bank_September_2026.csv'), 'utf8');
const iciciCsv = fs.readFileSync(path.join(__dirname, 'sample_statements', 'ICICI_Bank_September_2026.csv'), 'utf8');
const kotakCsv = fs.readFileSync(path.join(__dirname, 'sample_statements', 'Kotak_Bank_September_2026.csv'), 'utf8');

// [Test 2] Matching statement on active desk
console.log('\n[Test 2] Testing matching statement on active desk...');
mockWindow.setSelectedBankId('axis-7419');
const axisMatchRes = validateStatement(axisCsv, 'Axis_Bank_September_2026.csv');
assert(axisMatchRes.valid === true, 'Axis statement on Axis desk should be valid');
assert.strictEqual(axisMatchRes.bank.id, 'axis-7419');
console.log('✔ Axis statement matches Axis desk correctly.');

mockWindow.setSelectedBankId('icici-3021');
const iciciMatchRes = validateStatement(iciciCsv, 'ICICI_Bank_September_2026.csv');
assert(iciciMatchRes.valid === true, 'ICICI statement on ICICI desk should be valid');
assert.strictEqual(iciciMatchRes.bank.id, 'icici-3021');
console.log('✔ ICICI statement matches ICICI desk correctly.');

// [Test 3] Active Bank Desk Mismatch
console.log('\n[Test 3] Testing Active Bank Desk Mismatch (Axis statement on ICICI desk)...');
mockWindow.setSelectedBankId('icici-3021');
const mismatchRes1 = validateStatement(axisCsv, 'Axis_Bank_September_2026.csv');
assert(mismatchRes1.valid === false, 'Axis statement on ICICI desk must be rejected');
assert.strictEqual(mismatchRes1.type, 'desk_mismatch', 'Rejection type should be desk_mismatch');
assert.strictEqual(mismatchRes1.reasonTitle, 'Active Bank Desk Mismatch');
assert.strictEqual(mismatchRes1.actionType, 'switch_desk');
assert.strictEqual(mismatchRes1.suggestedBank.id, 'axis-7419');
console.log('✔ Rejected with desk_mismatch: ', mismatchRes1.reasonDesc);

console.log('\n[Test 3b] Testing Active Bank Desk Mismatch (ICICI statement on Kotak desk)...');
mockWindow.setSelectedBankId('kotak-8502');
const mismatchRes2 = validateStatement(iciciCsv, 'ICICI_Bank_September_2026.csv');
assert(mismatchRes2.valid === false, 'ICICI statement on Kotak desk must be rejected');
assert.strictEqual(mismatchRes2.type, 'desk_mismatch');
assert.strictEqual(mismatchRes2.suggestedBank.id, 'icici-3021');
console.log('✔ Rejected with desk_mismatch: ', mismatchRes2.reasonDesc);


// [Test 4] Unregistered Bank
console.log('\n[Test 4] Testing Unregistered Bank (Canara Bank)...');
const canaraCsv = `Canara Bank Current Account Statement
Account No: 123456789012
IFSC: CNRB0000456
Branch: Saraswathipuram, Mysore
Date,Narration,Ref No,Debit,Credit,Balance
06/09/2026,Payment received,REF100,,45000.00,545000.00
`;
mockWindow.setSelectedBankId('axis-7419');
const canaraRes = validateStatement(canaraCsv, 'canara_stmt.csv');
assert(canaraRes.valid === false, 'Canara Bank statement must be rejected');
assert(canaraRes.type === 'unregistered_bank' || canaraRes.type === 'unregistered_account');
assert.strictEqual(canaraRes.actionType, 'add_bank');
assert(canaraRes.actionLabel.includes('Add'));
console.log('✔ Canara Bank statement rejected with reason:', canaraRes.reasonTitle, '-', canaraRes.reasonDesc);

// [Test 5] Account Number Mismatch
console.log('\n[Test 5] Testing Account Number Mismatch (Different Axis Account)...');
const differentAxisCsv = `Axis Bank Current Account Statement
Account No: 921020009999999
IFSC: UTIB0000042
Branch: MG Road, Bangalore
Date,Narration,Ref No,Debit,Credit,Balance
06/09/2026,Payment received,REF100,,45000.00,545000.00
`;
mockWindow.setSelectedBankId('axis-7419');
const diffAccRes = validateStatement(differentAxisCsv, 'axis_alt_account.csv');
assert(diffAccRes.valid === false, 'Different account number must be rejected');
assert(diffAccRes.type === 'unregistered_account' || diffAccRes.type === 'desk_mismatch');
console.log('✔ Different account number rejected with reason:', diffAccRes.reasonTitle, '-', diffAccRes.reasonDesc);

// [Test 6] IFSC Code Mismatch
console.log('\n[Test 6] Testing IFSC Code Conflict...');
const ifscConflictCsv = `Statement
IFSC: HDFC0000123
Date,Narration,Ref No,Debit,Credit,Balance
06/09/2026,Payment received,REF100,,45000.00,545000.00
`;
mockWindow.setSelectedBankId('axis-7419');
const ifscRes = validateStatement(ifscConflictCsv, 'unknown_stmt.csv');
assert(ifscRes.valid === false, 'IFSC conflict must be rejected');
console.log('✔ IFSC conflict rejected with reason:', ifscRes.reasonTitle, '-', ifscRes.reasonDesc);

// [Test 7] Unverified Statement
console.log('\n[Test 7] Testing completely generic CSV with no bank info...');
const genericCsv = `Date,Narration,Ref No,Debit,Credit,Balance
06/09/2026,Random Transaction,REF100,,45000.00,545000.00
`;
mockWindow.setSelectedBankId('axis-7419');
const genericRes = validateStatement(genericCsv, 'random_data.csv');
assert(genericRes.valid === false, 'Generic CSV without bank info must be rejected');
assert.strictEqual(genericRes.type, 'unverified_statement');
console.log('✔ Generic file rejected with reason:', genericRes.reasonTitle, '-', genericRes.reasonDesc);

// [Test 8] Zero Auto-Registration
console.log('\n[Test 8] Testing zero auto-registration in corporateBanks...');
const initialCount = mockWindow.getCorporateBanks().length;
const detectResult = mockWindow.detectBankFromCsv(canaraCsv, 'canara_stmt.csv');
assert.strictEqual(detectResult.bank, null, 'Unregistered bank must return null bank');
assert.strictEqual(mockWindow.getCorporateBanks().length, initialCount, 'detectBankFromCsv must NOT add new banks to corporateBanks');
console.log('✔ corporateBanks length unchanged (' + initialCount + '). Auto-registration is completely disabled.');

// [Test 9] autoDetectBankAccounts disabled
console.log('\n[Test 9] Testing autoDetectBankAccounts returns false...');
mockWindow.autoDetectBankAccounts(false).then(res => {
  assert.strictEqual(res, false, 'autoDetectBankAccounts must return false');
  console.log('✔ autoDetectBankAccounts safely returned false.');
  console.log('\n============================================================');
  console.log(' ALL 9 BANK STATEMENT MATCHING & REJECTION TESTS PASSED! ');
  console.log('============================================================\n');
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
