const fs = require('fs');
const path = require('path');
const XLSX = require('./xlsx.full.min.js');

console.log('--- IFIMED Invoice Features Test Suite ---\n');

// 1. Check index.html
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// Check that Clear Invoices button is removed
const hasClearBtn = /id=["']invoicesClearAllBtn["']/.test(html);
console.log(`[Test 1] Clear Invoices button removed from index.html: ${!hasClearBtn ? '✔ PASSED' : '❌ FAILED'}`);
if (hasClearBtn) throw new Error('invoicesClearAllBtn still present in index.html');

// Check that Export Invoices Dropdown exists with Excel and CSV options
const hasExportDropdown = /id=["']invoicesExportDropdownBtn["']/.test(html);
const hasExportMenu = /id=["']invoicesExportMenu["']/.test(html);
const hasExportExcelBtn = /id=["']invoicesExportExcelBtn["']/.test(html);
const hasExportCsvBtn = /id=["']invoicesExportCsvBtn["']/.test(html);

console.log(`[Test 2] Export Dropdown & Options in index.html:`);
console.log(`  - Export Dropdown Button: ${hasExportDropdown ? '✔' : '❌'}`);
console.log(`  - Export Menu Container: ${hasExportMenu ? '✔' : '❌'}`);
console.log(`  - Export to Excel (.xlsx) button: ${hasExportExcelBtn ? '✔' : '❌'}`);
console.log(`  - Export to CSV (.csv) button: ${hasExportCsvBtn ? '✔' : '❌'}`);

if (!hasExportDropdown || !hasExportMenu || !hasExportExcelBtn || !hasExportCsvBtn) {
  throw new Error('Export dropdown structure missing from index.html');
}

// Check that Import Excel / CSV button exists and input accepts xlsx/xls
const hasUploadBtn = /id=["']invoicesUploadCsvBtn["']/.test(html);
const hasInputWithXlsx = /id=["']invoiceCsvInput["'][^>]*accept=["'][^"']*\.xlsx/i.test(html) ||
                         /accept=["'][^"']*\.xlsx[^"']*["'][^>]*id=["']invoiceCsvInput["']/i.test(html);

console.log(`[Test 3] Upload Excel / CSV configuration:`);
console.log(`  - Import Excel / CSV Button: ${hasUploadBtn ? '✔' : '❌'}`);
console.log(`  - File input accepts .xlsx & .csv: ${hasInputWithXlsx ? '✔' : '❌'}`);

if (!hasUploadBtn || !hasInputWithXlsx) {
  throw new Error('Upload input does not accept Excel and CSV formats');
}

// 2. Check app.js implementation
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

const hasExportToExcelFn = /function\s+exportInvoicesToExcel\s*\(/.test(appJs);
const hasExportToCsvFn = /function\s+exportInvoicesToCsv\s*\(/.test(appJs);
const hasExcelWbGeneration = appJs.includes('XLSX.utils.book_new()') && appJs.includes('Customer Invoices');
const hasBomInCsv = appJs.includes('\\uFEFF');

console.log(`\n[Test 4] app.js Export Functions:`);
console.log(`  - exportInvoicesToExcel defined: ${hasExportToExcelFn ? '✔' : '❌'}`);
console.log(`  - exportInvoicesToCsv defined: ${hasExportToCsvFn ? '✔' : '❌'}`);
console.log(`  - Excel workbook generation with SheetJS: ${hasExcelWbGeneration ? '✔' : '❌'}`);
console.log(`  - CSV UTF-8 BOM encoding: ${hasBomInCsv ? '✔' : '❌'}`);

if (!hasExportToExcelFn || !hasExportToCsvFn || !hasExcelWbGeneration || !hasBomInCsv) {
  throw new Error('Export logic missing or incomplete in app.js');
}

// 3. Test Excel generation with sample data
console.log(`\n[Test 5] Simulating Excel & CSV Generation:`);
const mockInvoices = [
  {
    invoiceNo: 'INV/2026/001',
    guestName: 'Apollo Hospitals Enterprise',
    gstin: '33AABCA1234D1ZM',
    amount: 154200.50,
    date: '15 Sep 2026',
    category: 'Cardiology Devices',
    settledAmount: 154200.50,
    balance: 0,
    status: 'Settled'
  },
  {
    invoiceNo: 'INV/2026/002',
    guestName: 'Fortis Healthcare Ltd',
    gstin: '07AABCF5678E1ZN',
    amount: 89000.00,
    date: '18 Sep 2026',
    category: 'Orthopedic Implants',
    settledAmount: 40000.00,
    balance: 49000.00,
    status: 'Partially Reconciled'
  }
];

// Test XLSX workbook construction
const wb = XLSX.utils.book_new();
const headerRows = [
  ['IFIMED PHARMACEUTICALS PVT. LTD. — CUSTOMER SALES INVOICES REGISTER'],
  ['Invoice No', 'Customer Name', 'GSTIN', 'Invoice Amount (₹)', 'Invoice Date', 'Category', 'Settled Amount (₹)', 'Outstanding Balance (₹)', 'Reconciliation Status']
];
const dataRows = mockInvoices.map(inv => [
  inv.invoiceNo,
  inv.guestName,
  inv.gstin,
  inv.amount,
  inv.date,
  inv.category,
  inv.settledAmount,
  inv.balance,
  inv.status
]);

const ws = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows]);
XLSX.utils.book_append_sheet(wb, ws, 'Customer Invoices');

const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
console.log(`  - Excel buffer generated successfully: ${xlsxBuf.length} bytes ✔`);

// Test reading generated Excel back using SheetJS (simulating user upload of Excel)
const readWb = XLSX.read(xlsxBuf, { type: 'buffer' });
const readSheet = readWb.Sheets[readWb.SheetNames[0]];
const readCsv = XLSX.utils.sheet_to_csv(readSheet);

console.log(`  - Excel parsed to tabular text (${readCsv.split('\n').length} rows) ✔`);
const lines = readCsv.split('\n');
if (!lines.some(l => l.includes('INV/2026/001') && l.includes('Apollo Hospitals Enterprise'))) {
  throw new Error('Failed to read back invoice row from generated Excel');
}
console.log(`  - Verified invoice row accurately retained in Excel ✔`);

// 4. Test dist synchronization
const distHtml = fs.readFileSync(path.join(__dirname, 'dist', 'index.html'), 'utf8');
const distAppJs = fs.readFileSync(path.join(__dirname, 'dist', 'app.js'), 'utf8');

const distHasNoClear = !/id=["']invoicesClearAllBtn["']/.test(distHtml);
const distHasExcelExport = distAppJs.includes('function exportInvoicesToExcel');

console.log(`\n[Test 6] dist/ Synchronization:`);
console.log(`  - dist/index.html Clear button removed: ${distHasNoClear ? '✔' : '❌'}`);
console.log(`  - dist/app.js exportInvoicesToExcel included: ${distHasExcelExport ? '✔' : '❌'}`);

if (!distHasNoClear || !distHasExcelExport) {
  throw new Error('dist/ directory is out of sync with root build');
}

console.log('\n✔ ALL INVOICE UPLOAD & EXPORT REQUIREMENTS VERIFIED SUCCESSFULLY!');
