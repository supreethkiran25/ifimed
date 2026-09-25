const fs = require('fs');

function parseAmount(val, options = {}) {
  if (val === undefined || val === null) return 0;
  let str = String(val).trim();
  if (!str || str === '-' || str === '--' || str.toLowerCase() === 'nil' || str.toLowerCase() === 'na') return 0;
  if (isDateLikeValue(str)) return 0;

  str = str.replace(/[₹\u20B9]/g, '').replace(/rs\.?/gi, '').trim();

  // Negative detection: parentheses like (12500) or trailing minus like 12500-
  // In accounting, 'Dr' is a Debit balance (Receivable = positive amount!), never negate!
  const isNegative = (str.startsWith('(') && str.endsWith(')')) || (str.endsWith('-') && !str.includes(' '));

  str = str.replace(/dr|cr/gi, '').trim();
  str = str.replace(/,/g, '');
  str = str.replace(/[^0-9.-]/g, '');

  if (!str || str === '-' || str === '.' || str === '-.') return 0;
  let num = parseFloat(str) || 0;
  if (isNegative) num = -Math.abs(num);
  return num;
}

function isPlausibleMoneyAmount(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num) || num === 0) return false;
  const abs = Math.abs(num);
  if (abs < 0.01 || abs > 100000000) return false;
  return true;
}

function isDateLikeValue(val) {
  if (!val) return false;
  const s = String(val).trim();
  return /^\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4}/.test(s) || /^\d{1,2}-[A-Za-z]{3}-\d{2,4}/.test(s);
}

function amountLooksLikeDateDigits(amount, dateStr) {
  return false;
}

function detectCsvDelimiter(csvText) {
  const sample = csvText.slice(0, 5000);
  const commas = (sample.match(/,/g) || []).length;
  const semicolons = (sample.match(/;/g) || []).length;
  const tabs = (sample.match(/\t/g) || []).length;
  if (tabs > commas && tabs > semicolons) return '\t';
  if (semicolons > commas) return ';';
  return ',';
}

function parseCsvLine(line, delimiter = ',') {
  const cols = [];
  let insideQuotes = false;
  let curVal = '';
  for (let c = 0; c < line.length; c++) {
    const char = line[c];
    if (char === '"' || char === "'") {
      insideQuotes = !insideQuotes;
    } else if (char === delimiter && !insideQuotes) {
      cols.push(curVal.trim().replace(/^["']|["']$/g, ''));
      curVal = '';
    } else {
      curVal += char;
    }
  }
  cols.push(curVal.trim().replace(/^["']|["']$/g, ''));
  return cols;
}

function findMaxPlausibleAmountInRow(cols, skipCols) {
  const skip = new Set((skipCols || []).filter(i => i >= 0));
  let maxAmt = 0;
  for (let i = 0; i < cols.length; i++) {
    if (skip.has(i)) continue;
    if (isDateLikeValue(cols[i])) continue;
    const amt = Math.abs(parseAmount(cols[i]));
    if (isPlausibleMoneyAmount(amt) && amt > maxAmt) {
      maxAmt = amt;
    }
  }
  return maxAmt;
}

async function processInvoiceCsvNew(csvText) {
  if (!csvText || !csvText.trim()) return [];
  if (csvText.charCodeAt(0) === 0xFEFF) csvText = csvText.slice(1);

  const delimiter = detectCsvDelimiter(csvText);
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) return [];

  let headerIndex = -1;
  let invNoCol = -1, custCol = -1, amtCol = -1, dateCol = -1, catCol = -1, gCol = -1;

  for (let i = 0; i < Math.min(lines.length, 50); i++) {
    const lineLower = lines[i].toLowerCase();
    const rawCols = parseCsvLine(lines[i], delimiter).map(c => c.trim().toLowerCase().replace(/[_\-\/\.\(\)\s]+/g, ' '));
    
    // Quick check if this line is just a metadata title line
    if (lineLower.startsWith('sales register for period') || lineLower.startsWith('statement period') || lineLower.startsWith('page ')) {
      continue;
    }

    const iIdx = rawCols.findIndex(c =>
      c === 'invoice' || c === 'inv' || c === 'invoice no' || c === 'inv no' || c === 'bill no' ||
      c === 'vch no' || c === 'voucher no' || c === 'doc no' || c === 'vch number' || c === 'voucher number' ||
      c === 'bill number' || c === 'inv number' || c === 'ref no' || c === 'reference no' ||
      c.includes('invoice no') || c.includes('inv no') || c.includes('bill no') || c.includes('vch no') ||
      c.includes('voucher no') || c === 'invoice #' || c === 'inv #' || c === 'bill #' || c === 'tax invoice no'
    );

    const cIdx = rawCols.findIndex(c =>
      c === 'customer' || c === 'party' || c === 'party name' || c === 'customer name' ||
      c === 'client' || c === 'guest' || c === 'particulars' || c === 'party particulars' ||
      c === 'buyer' || c === 'buyer name' || c === 'consignee' || c === 'consignee name' ||
      c === 'account name' || c === 'ledger name' || c === 'debtor' ||
      c.includes('customer') || c.includes('party') || c.includes('particulars') || c.includes('buyer') || c.includes('consignee') || (c.includes('name') && !c.includes('item') && !c.includes('product') && !c.includes('user'))
    );

    const dIdx = rawCols.findIndex(c =>
      c === 'date' || c === 'dt' || c === 'inv date' || c === 'invoice date' || c === 'vch date' ||
      c === 'voucher date' || c === 'bill date' || c === 'doc date' || c.includes('date')
    );

    const gIdx = rawCols.findIndex(c =>
      c === 'gstin' || c === 'gstin uin' || c === 'gstin/uin' || c === 'gst no' || c === 'gst number' ||
      c.includes('gstin') || c.includes('gst no')
    );

    const kIdx = rawCols.findIndex(c =>
      (c === 'category' || c === 'division' || c === 'vch type' || c === 'voucher type' || c === 'type') &&
      !c.includes('amount') && !c.includes('date')
    );

    // Prioritized Amount column
    let aIdx = rawCols.findIndex(c =>
      c === 'net amount' || c === 'net amt' || c === 'bill amount' || c === 'bill amt' ||
      c === 'total amount' || c === 'total amt' || c === 'net total' || c === 'invoice value' ||
      c === 'inv value' || c === 'invoice total' || c === 'grand total' || c === 'final amount' ||
      c === 'total bill amt' || c === 'total value' || c === 'total' || c === 'net'
    );
    if (aIdx === -1) {
      aIdx = rawCols.findIndex(c =>
        c === 'debit' || c === 'debit amount' || c === 'debit amt' || c === 'dr amount' ||
        c === 'dr amt' || c === 'debit rs' || c === 'dr rs' || c === 'dr'
      );
    }
    if (aIdx === -1) {
      aIdx = rawCols.findIndex(c =>
        c === 'gross total' || c === 'gross amount' || c === 'gross amt' || c === 'gross value' || c === 'gross'
      );
    }
    if (aIdx === -1) {
      aIdx = rawCols.findIndex(c =>
        (c === 'amount' || c === 'amt' || c === 'value' || c.includes('amount') || c.includes('total')) &&
        !c.includes('tax') && !c.includes('cgst') && !c.includes('sgst') && !c.includes('igst') &&
        !c.includes('cess') && !c.includes('tds') && !c.includes('tcs') && !c.includes('discount') &&
        !c.includes('round') && !c.includes('paid')
      );
    }
    if (aIdx === -1) {
      aIdx = rawCols.findIndex(c =>
        c === 'taxable value' || c === 'taxable amount' || c === 'taxable amt' || c === 'taxable'
      );
    }

    if (iIdx !== -1 || (cIdx !== -1 && (aIdx !== -1 || dIdx !== -1)) || (dIdx !== -1 && aIdx !== -1)) {
      headerIndex = i;
      invNoCol = iIdx;
      custCol = cIdx;
      amtCol = aIdx;
      dateCol = dIdx;
      catCol = kIdx;
      gCol = gIdx;
      break;
    }
  }

  const startLine = headerIndex >= 0 ? headerIndex + 1 : 1;
  const parsedInvoices = [];

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    const cols = parseCsvLine(line, delimiter);
    if (cols.length < 2) continue;

    // Check if line is a total/footer row
    const lineLower = line.toLowerCase();
    if (lineLower.startsWith('total') || lineLower.startsWith('grand total') || lineLower.startsWith('count ') || lineLower.includes('closing balance')) {
      continue;
    }

    let invoiceNo = (invNoCol >= 0 && cols[invNoCol]) ? cols[invNoCol].trim() : '';
    if (!invoiceNo) {
      const ifbCol = cols.find(c => /\bIFB[-_\s]?\d{3,}\b/i.test(c));
      invoiceNo = ifbCol ? (ifbCol.match(/\bIFB[-_\s]?\d{3,}\b/i)[0].toUpperCase()) : (cols[0] || `INV-${Date.now()}-${i}`);
    }

    const customer = (custCol >= 0 && cols[custCol]) ? cols[custCol].trim() : (cols[1] || 'Corporate Client');
    const date = (dateCol >= 0 && cols[dateCol]) ? cols[dateCol].trim() : (cols.find(c => isValidTransactionDate(c)) || '19 Sep 2026');
    
    let gstin = (gCol >= 0 && cols[gCol]) ? cols[gCol].trim().toUpperCase() : '';
    if (!gstin) {
      const gMatch = cols.find(c => /\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/i.test(c));
      if (gMatch) gstin = gMatch.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/i)[0].toUpperCase();
    }

    let category = (catCol >= 0 && cols[catCol]) ? cols[catCol].trim() : '';
    if (!category || !isNaN(parseFloat(category)) || category.length < 2) {
      category = 'General Pharma Supply';
    }

    let amount = amtCol >= 0 ? Math.abs(parseAmount(cols[amtCol])) : 0;
    if (!isPlausibleMoneyAmount(amount) || amountLooksLikeDateDigits(amount, date)) {
      amount = findMaxPlausibleAmountInRow(cols, [dateCol, invNoCol, custCol, gCol]);
    }

    if (!isPlausibleMoneyAmount(amount)) continue;
    if (isDateLikeValue(invoiceNo) || /^\d{1,2}$/.test(invoiceNo)) continue;

    parsedInvoices.push({
      invoiceNo,
      guestName: customer,
      gstin,
      amount,
      date,
      category,
      status: 'Unpaid',
      settledAmount: 0
    });
  }

  return parsedInvoices;
}

function isValidTransactionDate(val) {
  return true;
}

// RUN TESTS
(async () => {
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

  const tallyDrSuffixCsv = `
Date,Particulars,Voucher No.,Gross Total,CGST,SGST,Round Off,Total
01-Sep-2026,Apollo Hospitals Enterprise,IFB1082,"84,500.00 Dr",,,,"84,500.00 Dr"
02-Sep-2026,MedPlus Health Services,IFB1090,"1,25,000.00 Dr",,,,"1,25,000.00 Dr"
`;

  console.log('--- TEST 1: Tally Debit / Credit Register ---');
  const res1 = await processInvoiceCsvNew(tallyDebitCreditCsv);
  console.log(JSON.stringify(res1, null, 2));

  console.log('\n--- TEST 2: Marg ERP Sales Book ---');
  const res2 = await processInvoiceCsvNew(margErpCsv);
  console.log(JSON.stringify(res2, null, 2));

  console.log('\n--- TEST 3: Tally "Dr" suffix & Indian commas ---');
  const res3 = await processInvoiceCsvNew(tallyDrSuffixCsv);
  console.log(JSON.stringify(res3, null, 2));
})();
