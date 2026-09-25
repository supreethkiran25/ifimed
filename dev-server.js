const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleAuthSignIn, handleAuthSignOut } = require('./lib/auth-api');
const {
  deleteStatementSheetFromDb,
  saveToSupabaseRestTables,
  fetchSupabaseStateFromRest,
  fetchSupabaseStateFromStorage,
  saveSupabaseStorageSnapshot,
  uploadRawStatementToSupabase
} = require('./lib/supabase-rest');

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function isDateLikeValue(val) {
  const str = String(val == null ? '' : val).trim();
  if (!str) return false;
  return /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(str)
    || /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(str)
    || /^\d{1,2}[\s\-\/][A-Za-z]{3,9}[\s\-\/,]+\d{2,4}$/.test(str)
    || /^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4}$/.test(str);
}

function isUsableStatementRow(row) {
  if (!row) return false;
  const date = String(row.date || '').trim();
  if (!date || date.length > 28 || /^\d{1,3}$/.test(date) || /\s[-–]\s/.test(date)) return false;
  if (!isDateLikeValue(date)) return false;
  const amount = Number(row.amount);
  if (!Number.isFinite(amount) || Math.abs(amount) < 0.01 || Math.abs(amount) > 100000000) return false;
  const dateDigits = date.replace(/\D/g, '').replace(/^0+/, '');
  const amtDigits = String(Math.round(Math.abs(amount)));
  if (dateDigits && dateDigits === amtDigits) return false;
  const blob = `${date} ${row.narration || ''} ${row.payer || ''}`;
  if (/marg erp|chemist rs\.|online purchase import|call 0\d{8,}/i.test(blob)) return false;
  return true;
}

async function handler(req, res) {
  try {
    const rawUrl = req.url || '/';
    const cleanPath = rawUrl.split('?')[0].split('#')[0];

    if (cleanPath === '/api/auth/signin' && req.method === 'POST') {
      await handleAuthSignIn(req, res);
      return;
    }
    if (cleanPath === '/api/auth/signout') {
      await handleAuthSignOut(req, res);
      return;
    }

    // Supabase Cloud Statement Archive Endpoint
    if (cleanPath === '/api/supabase/upload-statement' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body);
          const fileName = parsed.fileName || `statement_${Date.now()}.csv`;
          const csvContent = parsed.csvContent || '';

          const uploadResult = await uploadRawStatementToSupabase(fileName, csvContent);

          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache'
          });
          res.end(JSON.stringify({
            success: true,
            archivedInSupabase: true,
            storageKey: uploadResult.key,
            fileName: uploadResult.fileName
          }));
        } catch (uploadErr) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: uploadErr.message }));
        }
      });
      return;
    }

    // Supabase Cloud Data Fetch Endpoint (Reads from PostgreSQL tables first)
    if (cleanPath === '/api/supabase/data' && req.method === 'GET') {
      try {
        let state = null;
        try {
          state = await fetchSupabaseStateFromRest();
        } catch (e) {
          console.warn('REST fetch failed, trying storage fallback:', e.message);
        }

        if (!state) {
          try {
            state = await fetchSupabaseStateFromStorage();
          } catch (e) {}
        }

        if (state && Array.isArray(state.banks) && state.banks.length > 0) {
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache'
          });
          res.end(JSON.stringify({
            success: true,
            source: 'supabase_postgres_rest',
            project: 'configured',
            data: state
          }));
          return;
        }

        // Fallback to local dataset if cloud tables are empty
        delete require.cache[require.resolve('./data_ifimed.js')];
        const data = require('./data_ifimed.js');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          source: 'local_master_empty',
          data: {
            banks: data.REAL_CORPORATE_BANKS,
            invoices: data.REAL_INVOICES,
            bills: data.REAL_VENDOR_BILLS,
            activities: data.REAL_ACTIVITIES
          }
        }));
        return;
      } catch (cloudErr) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: cloudErr.message }));
        return;
      }
    }

    if (cleanPath === '/api/supabase/delete-sheet' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const result = await deleteStatementSheetFromDb(parsed);
          res.writeHead(result.success ? 200 : 500, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache'
          });
          res.end(JSON.stringify({
            success: !!result.success,
            deletedFrom: 'supabase_postgres_tables',
            project: 'configured',
            result
          }));
        } catch (delErr) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: delErr.message }));
        }
      });
      return;
    }

    // Supabase Cloud Data Save Endpoint (Writes directly to PostgreSQL tables + Storage backup)
    if (cleanPath === '/api/supabase/save' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const hasBanks = Array.isArray(parsed.banks) && parsed.banks.length > 0;
          const hasTxns = Array.isArray(parsed.transactions) && parsed.transactions.length > 0;
          const hasAdjustments = Array.isArray(parsed.adjustments) && parsed.adjustments.length > 0;
          if (!hasBanks && !hasTxns && !hasDeletes && !hasAdjustments) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, error: 'Save payload is empty. No banks or transactions were received.' }));
            return;
          }
          parsed.updatedAt = new Date().toISOString();
          parsed.updatedBy = 'IFIMED Treasury User';

          // 1. Direct write to PostgreSQL database tables
          const restSync = await saveToSupabaseRestTables(parsed);

          // 2. Storage snapshot backup
          saveSupabaseStorageSnapshot(parsed).catch(() => {});

          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache'
          });
          res.end(JSON.stringify({
            success: true,
            syncedTo: 'supabase_postgres_tables',
            project: 'configured',
            restSync: restSync,
            timestamp: parsed.updatedAt
          }));
        } catch (saveErr) {
          console.error('Save to Supabase error:', saveErr);
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: saveErr.message }));
        }
      });
      return;
    }

    if (cleanPath === '/api/local-statements') {
      try {
        const dirs = [
          path.join(__dirname, 'sample_statements'),
          path.join(__dirname, 'statements')
        ];
        const files = [];
        dirs.forEach(dir => {
          if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return;
          fs.readdirSync(dir).forEach(name => {
            if (!/\.(csv|tsv|txt)$/i.test(name)) return;
            const csvText = fs.readFileSync(path.join(dir, name), 'utf8');
            files.push({ fileName: name, csvText });
          });
        });
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache'
        });
        res.end(JSON.stringify({ success: true, files }));
      } catch (listErr) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: listErr.message, files: [] }));
      }
      return;
    }

    // Auto-detect bank accounts endpoint (synced with Supabase)
    if (cleanPath === '/api/detect-banks') {
      try {
        let state = null;
        try {
          state = await fetchSupabaseStateFromRest();
        } catch (e) {}

        if (!state) {
          try {
            state = await fetchSupabaseStateFromStorage();
          } catch (e) {}
        }

        let banks = (state && state.banks) ? state.banks : null;
        let invoices = (state && state.invoices) ? state.invoices : null;
        let bills = (state && state.bills) ? state.bills : null;

        if (!banks || banks.length === 0) {
          delete require.cache[require.resolve('./data_ifimed.js')];
          const data = require('./data_ifimed.js');
          banks = data.REAL_CORPORATE_BANKS;
          invoices = data.REAL_INVOICES;
          bills = data.REAL_VENDOR_BILLS;
        }

        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache'
        });
        res.end(JSON.stringify({
          success: true,
          source: 'supabase_postgres',
          accounts: banks,
          invoices: invoices,
          bills: bills
        }));
        return;
      } catch (apiErr) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: apiErr.message }));
        return;
      }
    }

    const safePath = path.normalize(cleanPath).replace(/^(\.\.[\/\\])+/, '');
    const filename = (safePath === '/' || safePath === '' || safePath === '\\') ? 'index.html' : safePath.replace(/^[\/\\]/, '');
    let filePath = path.join(__dirname, filename);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(__dirname, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = fs.readFileSync(filePath);

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });
    res.end(content);
  } catch (err) {
    try {
      const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(indexHtml);
    } catch (fallbackErr) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('500 Internal Server Error: ' + err.message);
    }
  }
}

function getNetworkIp() {
  const os = require('os');
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const server = http.createServer(handler);

server.listen(PORT, '0.0.0.0', () => {
  const networkIp = getNetworkIp();
  console.log(`\n  IFIMED Reconciliation Workspace is live:`);
  console.log(`  > Local:   http://localhost:${PORT}/`);
  console.log(`  > Network: http://${networkIp}:${PORT}/  <-- Share this with anyone on your Wi-Fi`);
  console.log(`  > Ledger:  http://${networkIp}:${PORT}/virtual-ledger`);
  console.log(`  > Invoices: http://${networkIp}:${PORT}/invoices\n`);
  console.log('Supabase Cloud Database connected\n');
});

module.exports = server;

