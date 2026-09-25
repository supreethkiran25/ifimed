const fs = require('fs');
const assert = require('assert');

const appJs = fs.readFileSync('./app.js', 'utf8');
const start = appJs.indexOf('function isDateLikeValue');
const end = appJs.indexOf('function extractPartyFromNarration');
if (start < 0 || end < 0 || end <= start) {
  throw new Error('Could not extract parser helpers from app.js');
}
eval(appJs.slice(start, end));

console.log('--- Parser Guard Tests ---');

assert.strictEqual(parseAmount('31/07/2026'), 0, 'DD/MM/YYYY must not become an amount');
assert.strictEqual(parseAmount('2026-07-31'), 0, 'YYYY-MM-DD must not become an amount');
assert.strictEqual(parseAmount('18 Sep 2026'), 0, 'DD MMM YYYY must not become an amount');
assert.strictEqual(parseAmount('84,500.00'), 84500, 'Normal credit amount should parse');
assert.strictEqual(parseAmount('(12000)'), -12000, 'Parentheses should mark a debit');
console.log('✔ parseAmount rejects dates and keeps real money values');

assert.ok(isValidTransactionDate('31/07/2026'));
assert.ok(isValidTransactionDate('18 Sep 2026'));
assert.ok(!isValidTransactionDate('16'));
assert.ok(!isValidTransactionDate('MARG ERP NANO for Chemist Rs.5550'));
assert.ok(!isValidTransactionDate('01/07/2026 - 31/07/2026'));
console.log('✔ Transaction dates accept real dates and reject counts / ads / ranges');

assert.ok(amountLooksLikeDateDigits(31072026, '31/07/2026'));
assert.ok(amountLooksLikeDateDigits(3072026, '03/07/2026'));
assert.ok(!amountLooksLikeDateDigits(84500, '18 Sep 2026'));
console.log('✔ Date-digit amounts are detected as garbage');

assert.ok(isSalesRegisterOrInvoiceBook('SALES BOOK JULY 2027.XLS', 'Date,Bill No,Party\n31/07/2026,IFB00761,GUDDODGI'));
assert.ok(!isSalesRegisterOrInvoiceBook('ICICI_September_2026.csv', 'Date,Narration,Withdrawal (Dr),Deposit (Cr)\n18/09/2026,UPI/CR,0,84500'));
console.log('✔ Sales books are detected separately from bank statements');

assert.ok(isGarbageStatementRow({ date: '31/07/2026', amount: 31072026, narration: 'IFB00761' }));
assert.ok(isGarbageStatementRow({ date: '16', amount: 16, narration: '31/07/2026' }));
assert.ok(!isGarbageStatementRow({ date: '18 Sep 2026', amount: 84500, narration: 'UPI/CR/626/Apollo' }));
console.log('✔ Garbage statement rows are filtered');

const cleaned = sanitizeCorporateBanks([
  {
    id: 'canara-2019',
    name: 'Canara Bank',
    accNo: '•••\uFFFD\uFFFD2019',
    fullAccNo: '129088192019',
    sheets: [
      {
        monthId: '2026-07',
        fileName: 'SALES BOOK JULY 2027.XLS',
        records: [
          { date: '31/07/2026', amount: 31072026, narration: 'IFB00761' },
          { date: '18 Sep 2026', amount: 84500, narration: 'UPI/CR/Apollo' }
        ],
        debitRecords: []
      }
    ]
  }
]);
assert.strictEqual(cleaned[0].accNo, '••••2019');
assert.strictEqual(cleaned[0].sheets[0].records.length, 1);
assert.strictEqual(cleaned[0].sheets[0].records[0].amount, 84500);
console.log('✔ Loaded bank data is sanitized (acc no + junk rows)');

console.log('\nAll parser guard tests passed.');
