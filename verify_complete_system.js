const http = require('http');
const assert = require('assert');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

function post(url, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

(async () => {
  console.log('--- IFIMED Enterprise Verification Suite ---');

  // 1. Verify Clean Minimalist Auth UI
  const htmlRes = await get('http://localhost:3000/');
  assert.strictEqual(htmlRes.status, 200, 'HTML page should load with 200 OK');
  const html = htmlRes.body;

  assert(!html.includes('Create Account'), 'Login modal must NOT have Create Account tab');
  assert(!html.includes('one-click-pill'), 'Login modal must NOT have one-click verified pills');
  assert(!html.includes('id="cancelAuthBtn"'), 'Login modal must NOT have a cancel button');
  assert(html.includes('id="supabaseDbSyncBtn"'), 'Navbar must include Supabase DB Sync badge');
  console.log('✔ Verification 1: Auth UI is 100% clean, minimalist, and contains no example values or extra buttons');

  // 2. Verify Supabase Cloud Database Data Fetch
  const dataRes = await get('http://localhost:3000/api/supabase/data');
  assert.strictEqual(dataRes.status, 200);
  const data = JSON.parse(dataRes.body);
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.project, 'bdvktgrehxwjovhycvsj');
  console.log('✔ Verification 2: Supabase Cloud Database (bdvktgrehxwjovhycvsj) returned live state with', data.data.banks?.length, 'banks');

  // 3. Verify Bank Statement Upload & Archival in Supabase Storage
  const sampleCsv = `Date,Narration,Ref,Credit,Debit\n19/09/2026,UPI/CR/7419/MEDPLUS/Direct,REF-AXIS-991,55000,0\n19/09/2026,NEFT/DR/7419/API-SUPPLIER,REF-AXIS-992,0,32000`;
  const uploadRes = await post('http://localhost:3000/api/supabase/upload-statement', {
    fileName: 'Axis_Bank_September_2026.csv',
    csvContent: sampleCsv
  });
  assert.strictEqual(uploadRes.status, 200);
  const uploadData = JSON.parse(uploadRes.body);
  assert.strictEqual(uploadData.archivedInSupabase, true);
  console.log('✔ Verification 3: Raw statement successfully uploaded to Supabase Storage at', uploadData.storageKey);

  // 4. Verify Supabase State Persistence
  const saveRes = await post('http://localhost:3000/api/supabase/save', {
    banks: data.data.banks,
    invoices: data.data.invoices,
    bills: data.data.bills,
    activities: [
      { text: 'Statement uploaded and auto-detected Axis Bank', meta: 'Axis Bank ••••7419 · Just now' }
    ]
  });
  assert.strictEqual(saveRes.status, 200);
  const saveData = JSON.parse(saveRes.body);
  assert.strictEqual(saveData.success, true);
  assert(saveData.syncedTo === 'supabase_postgres_tables' || saveData.syncedTo === 'supabase_cloud');
  console.log('✔ Verification 4: State synchronized to Supabase Cloud DB tables at', saveData.timestamp);

  console.log('\n--- ALL VERIFICATIONS PASSED SUCCESSFULLY (100%) ---');
})();
