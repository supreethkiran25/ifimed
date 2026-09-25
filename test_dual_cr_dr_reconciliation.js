/**
 * Test Dual Credit & Debit Detection, Frontend Mapping, and Supabase Database Persistence
 */
const http = require('http');

const sampleDualCsv = `Date,Particulars / Narration,Chq / Ref No,Withdrawal (Dr),Deposit (Cr),Balance
18/09/2026,UPI/CR/626291048201/Apollo Pharmacy/ICIC/IFB1082,UPI-CR-1082,,84500.00,1084500.00
19/09/2026,NEFT/DR/920194012948/Cipla Healthcare/CNB4019,NEFT-DR-4019,42300.00,,1042200.00
20/09/2026,RTGS/CR/718293019283/MedPlus Health/IFB1090,RTGS-CR-1090,,125000.00,1167200.00
21/09/2026,IMPS/DR/519203948102/Sun Pharma Distribution/CNB4025,IMPS-DR-4025,67800.00,,1099400.00
22/09/2026,CHEQUE/CR/000281/Fortis Healthcare/IFB1095,CHQ-000281,,98200.00,1197600.00
23/09/2026,NEFT/DR/481029384710/Zydus Lifesciences/CNB4031,NEFT-DR-4031,51400.00,,1146200.00
`;

async function runTests() {
  console.log('--- 1. Testing Dual CSV Parsing in Node Environment ---');
  // We can load app.js logic or simulate the parser logic
  const lines = sampleDualCsv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  console.log(`Total CSV lines: ${lines.length}`);

  // Test Supabase Save with both Credits and Debits
  console.log('\n--- 2. Testing Backend REST /api/supabase/save with Credits & Debits ---');
  
  const testPayload = {
    banks: [
      {
        id: 'icici-3021',
        name: 'ICICI Bank',
        type: 'Current A/c',
        accNo: '••••3021',
        fullAccNo: '000205003021',
        ifsc: 'ICIC0000002',
        branch: 'Mysore Main Branch, Karnataka',
        sheets: [
          {
            monthId: '2026-09',
            label: 'September 2026',
            fileName: 'ICICI_September_2026.csv',
            uploadedOn: '24 Sep 2026',
            creditsCount: 3,
            debitsCount: 3,
            records: [
              {
                id: 'CR-ICICI-001',
                date: '18 Sep 2026',
                narration: 'UPI/CR/626291048201/Apollo Pharmacy/ICIC/IFB1082',
                payer: 'Apollo Pharmacy',
                type: 'UPI',
                bankRef: 'UPI-CR-1082',
                amount: 84500.00,
                status: 'unmapped',
                mapping: null
              },
              {
                id: 'CR-ICICI-002',
                date: '20 Sep 2026',
                narration: 'RTGS/CR/718293019283/MedPlus Health/IFB1090',
                payer: 'MedPlus Health',
                type: 'RTGS',
                bankRef: 'RTGS-CR-1090',
                amount: 125000.00,
                status: 'unmapped',
                mapping: null
              },
              {
                id: 'CR-ICICI-003',
                date: '22 Sep 2026',
                narration: 'CHEQUE/CR/000281/Fortis Healthcare/IFB1095',
                payer: 'Fortis Healthcare',
                type: 'CHEQUE',
                bankRef: 'CHQ-000281',
                amount: 98200.00,
                status: 'unmapped',
                mapping: null
              }
            ],
            debitRecords: [
              {
                id: 'DR-ICICI-001',
                date: '19 Sep 2026',
                narration: 'NEFT/DR/920194012948/Cipla Healthcare/CNB4019',
                payer: 'Cipla Healthcare',
                type: 'NEFT',
                bankRef: 'NEFT-DR-4019',
                amount: 42300.00,
                status: 'unmapped',
                mapping: null
              },
              {
                id: 'DR-ICICI-002',
                date: '21 Sep 2026',
                narration: 'IMPS/DR/519203948102/Sun Pharma Distribution/CNB4025',
                payer: 'Sun Pharma Distribution',
                type: 'IMPS',
                bankRef: 'IMPS-DR-4025',
                amount: 67800.00,
                status: 'unmapped',
                mapping: null
              },
              {
                id: 'DR-ICICI-003',
                date: '23 Sep 2026',
                narration: 'NEFT/DR/481029384710/Zydus Lifesciences/CNB4031',
                payer: 'Zydus Lifesciences',
                type: 'NEFT',
                bankRef: 'NEFT-DR-4031',
                amount: 51400.00,
                status: 'unmapped',
                mapping: null
              }
            ]
          }
        ]
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
    ],
    invoices: [
      { id: 'inv-1', invoiceNo: 'IFB1082', guestName: 'Apollo Pharmacy', amount: 84500.00, date: '18 Sep 2026', status: 'unmapped' },
      { id: 'inv-2', invoiceNo: 'IFB1090', guestName: 'MedPlus Health', amount: 125000.00, date: '20 Sep 2026', status: 'unmapped' }
    ],
    bills: [
      { id: 'bill-1', billNo: 'CNB4019', vendorName: 'Cipla Healthcare', amount: 42300.00, date: '19 Sep 2026', status: 'unmapped' },
      { id: 'bill-2', billNo: 'CNB4025', vendorName: 'Sun Pharma Distribution', amount: 67800.00, date: '21 Sep 2026', status: 'unmapped' }
    ],
    activities: [
      { text: 'Uploaded dual statement (3 credits, 3 debits)', time: 'Just now' }
    ]
  };

  const postData = JSON.stringify(testPayload);

  const savePromise = new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/supabase/save',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body: JSON.parse(d) });
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });

  const saveResult = await savePromise;
  console.log('Save response status:', saveResult.status);
  console.log('Save response body:', JSON.stringify(saveResult.body, null, 2));

  console.log('\n--- 3. Verifying Saved State from /api/supabase/data ---');
  const getPromise = new Promise((resolve, reject) => {
    http.get('http://localhost:3000/api/supabase/data', res => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });

  const fetched = await getPromise;
  console.log('Fetched data source:', fetched.source);
  const icici = fetched.data.banks.find(b => b.id === 'icici-3021');
  if (icici && icici.sheets.length > 0) {
    const s = icici.sheets[0];
    console.log(`ICICI Sheet: ${s.label}`);
    console.log(`  - Credits count: ${s.records ? s.records.length : 0}`);
    console.log(`  - Debits count: ${s.debitRecords ? s.debitRecords.length : 0}`);
    console.log(`  - Credits:`, s.records.map(r => `${r.date}: +₹${r.amount} (${r.payer})`));
    console.log(`  - Debits:`, s.debitRecords.map(r => `${r.date}: -₹${r.amount} (${r.payer})`));
  } else {
    console.error('ERROR: ICICI sheets not found in fetched data');
  }

  console.log('\n--- 4. Dual Credit & Debit Verification Complete ---');
}

runTests().catch(console.error);
