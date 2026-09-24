const { handleAuthSignIn } = require('../../lib/auth-api');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
    return;
  }
  await handleAuthSignIn(req, res);
};
