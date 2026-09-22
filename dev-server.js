const http = require('http');
const fs = require('fs');
const path = require('path');

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

function handler(req, res) {
  try {
    const rawUrl = req.url || '/';
    const cleanPath = rawUrl.split('?')[0].split('#')[0];

    // Auto-detect bank accounts endpoint
    if (cleanPath === '/api/detect-banks') {
      try {
        delete require.cache[require.resolve('./data_ifimed.js')];
        const data = require('./data_ifimed.js');
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache'
        });
        res.end(JSON.stringify({
          success: true,
          source: 'C:\\Users\\ASUS\\Downloads\\ifimed',
          accounts: data.REAL_CORPORATE_BANKS,
          invoices: data.REAL_INVOICES,
          bills: data.REAL_VENDOR_BILLS
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

const server = http.createServer(handler);

server.listen(PORT, () => {
  console.log(`IFIMED Reconciliation Server running at http://localhost:${PORT}/`);
});

module.exports = server;
