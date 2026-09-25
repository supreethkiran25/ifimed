const fs = require('fs');
const path = require('path');

// Extract functions from app.js to test in isolation
const appCode = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

// Test Case 1: Tally Sales Register with Debit / Credit columns
const tallyDebitCreditCsv = `
IFIMED PHARMACEUTICALS PVT. LTD.
SALES REGISTER FOR PERIOD: 01-09-2026 to 30-09-2026
GSTIN: 29AABCU9603R1ZM

Date,Particulars,Vch Type,Vch No.,Debit,Credit
01-09-2026,Apollo Hospitals Enterprise,Sales,IFB-1082,84500.00,
02-09-2026,MedPlus Health Services,Sales,IFB-1090,125000.00,
03-09-2026,Fortis Healthcare Ltd,Sales,IFB-1095,98200.00,
04-09-2026,Vyshnavi Associates,Sales,IFB-1102,74720.00,
`;

// Test Case 2: Marg ERP Sales Book with multiple tax columns
const margErpCsv = `
M/S IFIMED PHARMACEUTICALS PVT LTD
SALES BOOK FROM 01-09-2026 TO 30-09-2026
D.L.No.: KA-MY-123456, GSTIN: 29AABCU9603R1ZM

Date,Bill No.,Party Name,GSTIN,Taxable Amount,CGST,SGST,IGST,Bill Amount
01/09/2026,IFB1082,Apollo Hospitals Enterprise,33AABCA1234D1ZM,75446.43,4526.79,4526.79,,84500.00
02/09/2026,IFB1090,MedPlus Health Services,36AAACT1234F1Z5,111607.14,6696.43,6696.43,,125000.00
03/09/2026,IFB1095,Fortis Healthcare Ltd,07AABCF5678E1ZN,87678.57,5260.71,5260.71,,98200.00
04/09/2026,IFB1102,Vyshnavi Associates,29AABCV9999P1ZQ,66714.29,4002.86,4002.86,,74720.00
`;

// Test Case 3: Tally Columnar with "84,500.00 Dr"
const tallyDrSuffixCsv = `
Date,Particulars,Voucher No.,Gross Total,CGST,SGST,Round Off,Total
01-Sep-2026,Apollo Hospitals Enterprise,IFB1082,"84,500.00 Dr",,,,"84,500.00 Dr"
02-Sep-2026,MedPlus Health Services,IFB1090,"1,25,000.00 Dr",,,,"1,25,000.00 Dr"
`;

console.log('Testing sales book parsing...');

// Run small harness using the existing functions in app.js
const vm = require('vm');
const sandbox = {
  console,
  appInvoices: [],
  corporateBanks: [],
  appVendorBills: [],
  showToast: (msg, type) => console.log(`[Toast ${type || 'info'}]: ${msg}`),
  persistToSupabase: async () => {},
  renderAll: () => {},
  window: {}
};
vm.createContext(sandbox);

// Load helper functions and processInvoiceCsv from app.js
const snippet = `
${appCode.slice(appCode.indexOf('function amountLooksLikeDateDigits'), appCode.indexOf('function sanitizeMaskedAccNo'))}
${appCode.slice(appCode.indexOf('function detectCsvDelimiter'), appCode.indexOf('function parseDateToMonthId'))}
function isValidTransactionDate(val) { return true; }
${appCode.slice(appCode.indexOf('async function processInvoiceCsv'), appCode.indexOf('function getInvoiceReconciliationData'))}
`;

try {
  vm.runInContext(snippet, sandbox);
  console.log('Loaded functions into VM sandbox successfully.');

  (async () => {
    console.log('\n--- Test Case 1: Tally Debit / Credit Sales Register ---');
    sandbox.appInvoices = [];
    await sandbox.processInvoiceCsv(tallyDebitCreditCsv);
    console.log('Parsed Invoices:', JSON.stringify(sandbox.appInvoices, null, 2));

    console.log('\n--- Test Case 2: Marg ERP Sales Book ---');
    sandbox.appInvoices = [];
    await sandbox.processInvoiceCsv(margErpCsv);
    console.log('Parsed Invoices:', JSON.stringify(sandbox.appInvoices, null, 2));

    console.log('\n--- Test Case 3: Tally "Dr" suffix & Indian commas ---');
    sandbox.appInvoices = [];
    await sandbox.processInvoiceCsv(tallyDrSuffixCsv);
    console.log('Parsed Invoices:', JSON.stringify(sandbox.appInvoices, null, 2));
  })();
} catch (e) {
  console.error('Error running snippet:', e);
}
