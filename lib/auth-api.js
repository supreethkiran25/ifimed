const https = require('https');
const { assertSupabaseConfig } = require('./server-env');

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      resolve(req.body);
      return;
    }
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    user_metadata: user.user_metadata || {}
  };
}

function supabaseAuthRequest(pathname, method, data, apiKey) {
  return new Promise((resolve, reject) => {
    const cfg = assertSupabaseConfig();
    const postData = data ? JSON.stringify(data) : '';
    const req = https.request({
      hostname: `${cfg.projectRef}.supabase.co`,
      path: pathname,
      method,
      headers: {
        apikey: apiKey,
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
      }
    }, res => {
      let d = '';
      res.on('data', chunk => { d += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = d ? JSON.parse(d) : {}; } catch (e) { json = { raw: d }; }
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(json);
        else reject(new Error(json.error_description || json.msg || json.error || `Auth failed (${res.statusCode})`));
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function handleAuthSignIn(req, res) {
  try {
    const body = await readJsonBody(req);
    const email = String(body.email || '').trim();
    const password = String(body.password || '');
    if (!email || !password) {
      sendJson(res, 400, { success: false, error: 'Email and password are required.' });
      return;
    }
    const cfg = assertSupabaseConfig();
    const key = cfg.anonKey || cfg.serviceKey;
    const data = await supabaseAuthRequest('/auth/v1/token?grant_type=password', 'POST', { email, password }, key);
    sendJson(res, 200, { success: true, user: publicUser(data.user) });
  } catch (err) {
    sendJson(res, 401, { success: false, error: err.message || 'Invalid email or password.' });
  }
}

async function handleAuthSignOut(req, res) {
  sendJson(res, 200, { success: true });
}

module.exports = { handleAuthSignIn, handleAuthSignOut, sendJson, readJsonBody };
