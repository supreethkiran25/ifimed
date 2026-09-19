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
    const safePath = path.normalize(cleanPath).replace(/^(\.\.[\/\\])+/, '');
    const filename = (safePath === '/' || safePath === '' || safePath === '\\') ? 'index.html' : safePath.replace(/^[\/\\]/, '');
    let filePath = path.join(__dirname, filename);

    // Fallback to index.html if file doesn't exist or is a directory
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(__dirname, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = fs.readFileSync(filePath);

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=0, must-revalidate'
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

// Only listen on port when executed directly (e.g. node server.js or npm run dev)
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`IFIMED Reconciliation Server running at http://localhost:${PORT}/`);
  });
}

// Export handler for serverless / cloud platforms (Vercel, AWS Lambda, etc.)
module.exports = handler;
