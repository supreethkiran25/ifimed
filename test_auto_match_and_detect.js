const fs = require('fs');
const path = require('path');
const http = require('http');

function extractStatementDocCodes(text) {
  const raw = String(text || '');
  const found = [];
  [
    /\bIFB\d{3,}\b/gi,
    /\bCNB\d{3,}\b/gi,
    /\bINV[-_/\s]?\d{3,}\b/gi,
    /\bBILL[-_/\s]?\d{3,}\b/gi
  ].forEach(re => {
    const hits = raw.match(re);
    if (hits) hits.forEach(h => found.push(String(h).replace(/\s+/g, '').toUpperCase()));
  });
  return [...new Set(found)];
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const sampleIcici = fs.readFileSync(path.join(__dirname, 'sample_statements', 'ICICI_Bank_September_2026.csv'), 'utf8');
assert(extractStatementDocCodes('UPI/CR/626291048201/Apollo Pharmacy/ICIC/IFB1082').includes('IFB1082'), 'credit IFB');
assert(extractStatementDocCodes('NEFT/DR/920194012948/Cipla Healthcare/CNB4019').includes('CNB4019'), 'debit CNB');
assert(extractStatementDocCodes(sampleIcici).includes('IFB1082'), 'sample file IFB');
assert(extractStatementDocCodes('UPI/HARSHITH V/malipatilharssh/UPI/CANARA BANK/658020480991').length === 0, 'kariya has no doc code');
console.log('✔ Auto-Match code extraction');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d, ct: res.headers['content-type'] || '' }));
    }).on('error', reject);
  });
}

(async () => {
  const res = await get('http://localhost:3000/api/local-statements');
  assert(res.status === 200 && res.ct.includes('json'), 'local-statements status');
  const data = JSON.parse(res.body);
  assert(data.success && data.files.length >= 3, 'local files listed');
  const names = data.files.map(f => f.fileName).join(',');
  assert(/ICICI/i.test(names) && /Axis/i.test(names) && /Kotak/i.test(names), 'all three sample banks present');
  assert(data.files.every(f => /Account No|A\/c No|IFSC/i.test(f.csvText)), 'files include account headers');
  console.log('✔ Auto-Detect local statement files:', data.files.map(f => f.fileName).join(', '));
})().catch(err => {
  console.error('✖', err.message);
  process.exit(1);
});
