const assert = require('assert');
const fs = require('fs');

const appJs = fs.readFileSync('./app.js', 'utf8');

function sliceBetween(startText, endText) {
  const start = appJs.indexOf(startText);
  const end = appJs.indexOf(endText);
  if (start < 0 || end < 0 || end <= start) throw new Error('slice failed: ' + startText);
  return appJs.slice(start, end);
}

eval(sliceBetween('function digitsOnly', 'function showToast'));
eval(sliceBetween('function detectCsvDelimiter', 'function isDateLikeValue'));
eval(sliceBetween('const MONTH_ABBR_INDEX', 'function amountLooksLikeDateDigits'));

assert.strictEqual(parseDateToMonthId('05/07/2026'), '2026-07');
assert.strictEqual(parseDateToMonthId('15/08/2026 00:00:00'), '2026-08');
assert.strictEqual(parseDateToMonthId('01-Sep-2026'), '2026-09');
assert.strictEqual(parseDateToMonthId('2026-07-22'), '2026-07');
assert.ok(parseDateToMonthId('45273'), 'Excel serial dates must resolve to a month');
console.log('✔ Date parser splits Jul / Aug / Sep and accepts times + serials');

const months = ['05/07/2026', '12/07/2026', '03/08/2026', '22/08/2026', '01/09/2026', '18/09/2026 10:15:00']
  .map(parseDateToMonthId);
assert.deepStrictEqual([...new Set(months)], ['2026-07', '2026-08', '2026-09']);
console.log('✔ Multi-month statement dates stay in their own months');

const row = extractRowDateAndMonth(['1', '15/08/2026 00:00:00', 'UPI', '5000'], 1);
assert.strictEqual(row.monthId, '2026-08');
assert.strictEqual(row.date, '15/08/2026');
console.log('✔ Row date extractor uses the transaction date column');

let corporateBanks = [
  { id: 'icici-3021', name: 'ICICI Bank', accNo: '••••3021', fullAccNo: '000205003021', ifsc: 'ICIC0000002', sheets: [] },
  { id: 'axis-7419', name: 'Axis Bank', accNo: '••••7419', fullAccNo: '921020007419821', ifsc: 'UTIB0000042', sheets: [] },
  { id: 'kotak-8502', name: 'Kotak Mahindra Bank', accNo: '••••8502', fullAccNo: '711200988502', ifsc: 'KKBK0000421', sheets: [] }
];
function getActiveBank() { return corporateBanks[1]; }

eval(sliceBetween('const IFSC_BANK_NAMES', 'function detectMonthFromCsvLines'));

const sampleIcici = fs.readFileSync('./sample_statements/ICICI_Bank_September_2026.csv', 'utf8');
const extractedIcici = extractStatementBankDetails(sampleIcici, 'ICICI_Bank_September_2026.csv');
assert.strictEqual(extractedIcici.name, 'ICICI Bank');
assert.strictEqual(extractedIcici.fullAccNo, '000205003021');
assert.strictEqual(extractedIcici.ifsc, 'ICIC0000002');
console.log('✔ Statement header yields ICICI name, A/c and IFSC');

const iciciVsAxisSuffix = detectBankFromCsv(
  'Chq No. 7419\nDate,Narration,Ref,Amount\n05/07/2026,UPI/axis bank/shop,REF100,5000',
  'ICICI_Bank_Jul_to_Sep.xlsx'
);
assert.strictEqual(iciciVsAxisSuffix.bank.id, 'icici-3021', 'ICICI filename must beat Axis cheque suffix / UPI counterparty');
console.log('✔ ICICI filename is not stolen by Axis suffix 7419');

const axisFile = detectBankFromCsv('Date,Narration,Ref,Amount\n19/09/2026,UPI Payment,REF100,5000', 'Axis_Bank_September.csv');
assert.strictEqual(axisFile.bank.id, 'axis-7419');
console.log('✔ Axis still detected from its own filename');

const iciciAcc = detectBankFromCsv('Account Statement for 000205003021\nDate,Narration,Ref,Amount\n19/09/2026,Deposit,REF101,15000', 'statement.csv');
assert.strictEqual(iciciAcc.bank.id, 'icici-3021');
console.log('✔ ICICI detected from account number even with a generic filename');

const kotakIfsc = detectBankFromCsv('IFSC Code: KKBK0000421\nDate,Narration,Ref,Amount\n19/09/2026,RTGS Inward,REF102,75000', 'bank_export.csv');
assert.strictEqual(kotakIfsc.bank.id, 'kotak-8502');
console.log('✔ Kotak detected from IFSC');

const canara = detectBankFromCsv('Canara Bank Commercial Branch\nAccount No: 129088192019\nIFSC: CNRB0001928\nDate,Narration,Ref,Amount\n19/09/2026,UPI,REF103,12000', 'canara_sep.csv');
assert.strictEqual(canara.bank.name, 'Canara Bank');
assert.strictEqual(canara.isNew, true);
console.log('✔ New Canara account is still auto-registered');

const XLSX = require('xlsx');
const kariyaPath = 'C:/Users/ASUS/Desktop/kariya statement.xls';
if (fs.existsSync(kariyaPath)) {
  const kariyaWb = XLSX.readFile(kariyaPath, { cellDates: true, dateNF: 'dd/mm/yyyy' });
  const kariyaCsv = kariyaWb.SheetNames.map(n => XLSX.utils.sheet_to_csv(kariyaWb.Sheets[n], { dateNF: 'dd/mm/yyyy' })).join('\n');
  const kariya = detectBankFromCsv(kariyaCsv, 'kariya statement.xls', { sheetNames: kariyaWb.SheetNames });
  assert.strictEqual(kariya.bank.name, 'ICICI Bank');
  assert.strictEqual(kariya.extracted.fullAccNo, '111401540946');
  assert.notStrictEqual(kariya.bank.id, 'axis-7419');
  assert.notStrictEqual(kariya.bank.fullAccNo, '921020007419821');
  console.log('✔ kariya statement.xls is ICICI A/c 111401540946, not Axis');
}

console.log('\nAll bank + month detection checks passed.');
