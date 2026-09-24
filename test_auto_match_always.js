/**
 * Auto-Match All must map every open credit and debit, creating INV-/BILL- docs when needed.
 */
function createStatementDoc(row, isDebit, used) {
  const party = row.payer || (isDebit ? 'Vendor' : 'Customer');
  const safeParty = String(party).replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase() || 'STMT';
  const amt = String(Math.round(Math.abs(Number(row.amount) || 0)));
  const datePart = String(row.date || '').replace(/\D/g, '').slice(-6) || '240926';
  const prefix = isDebit ? 'BILL' : 'INV';
  let code = `${prefix}-${safeParty}-${datePart}-${amt}`;
  let n = 1;
  while (used.has(code.toLowerCase())) {
    code = `${prefix}-${safeParty}-${datePart}-${amt}-${n++}`;
  }
  return { invoiceNo: isDebit ? null : code, billNo: isDebit ? code : null, guestName: party, vendorName: party };
}

function applyAutoMapping(row, doc, isDebit, used) {
  const docNo = isDebit ? (doc.billNo || doc.invoiceNo) : (doc.invoiceNo || doc.billNo);
  row.status = 'mapped';
  row.mapping = { invoiceNo: doc.invoiceNo || doc.billNo, billNo: doc.billNo || doc.invoiceNo };
  used.add(String(docNo).toLowerCase());
}

function autoMatchAll(banks) {
  const used = new Set();
  let count = 0;
  banks.forEach(bank => {
    (bank.sheets || []).forEach(sheet => {
      (sheet.records || []).forEach(row => {
        if (row.status === 'mapped') return;
        applyAutoMapping(row, createStatementDoc(row, false, used), false, used);
        count++;
      });
      (sheet.debitRecords || []).forEach(row => {
        if (row.status === 'mapped') return;
        applyAutoMapping(row, createStatementDoc(row, true, used), true, used);
        count++;
      });
    });
  });
  return count;
}

const banks = [{
  id: 'axis-7419',
  sheets: [{
    monthId: '2026-07',
    records: [
      { id: 'CR-1', date: '22/07/2026', payer: 'Apollo', amount: 1200, status: 'unmapped' },
      { id: 'CR-2', date: '23/07/2026', payer: 'MedPlus', amount: 800, status: 'unmapped' }
    ],
    debitRecords: [
      { id: 'DR-1', date: '24/07/2026', payer: 'Cipla', amount: 500, status: 'unmapped' }
    ]
  }]
}];

const mapped = autoMatchAll(banks);
if (mapped !== 3) throw new Error(`expected 3 mapped, got ${mapped}`);
const rows = [].concat(banks[0].sheets[0].records, banks[0].sheets[0].debitRecords);
if (rows.some(r => r.status !== 'mapped' || !r.mapping)) throw new Error('every open row must be mapped');
if (!String(rows[0].mapping.invoiceNo).startsWith('INV-')) throw new Error('credits must get INV docs');
if (!String(rows[2].mapping.billNo).startsWith('BILL-')) throw new Error('debits must get BILL docs');
if (autoMatchAll(banks) !== 0) throw new Error('already-mapped rows must stay mapped');
console.log('✔ Auto-Match All maps every open credit and debit');
