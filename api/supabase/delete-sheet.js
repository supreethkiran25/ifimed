const { readJsonBody, sendJson } = require('../../lib/auth-api');
const { deleteStatementSheetFromDb } = require('../../lib/supabase-rest');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    sendJson(res, 405, { success: false, error: 'Method not allowed' });
    return;
  }
  try {
    const parsed = await readJsonBody(req);
    const result = await deleteStatementSheetFromDb(parsed);
    sendJson(res, result.success ? 200 : 500, {
      success: !!result.success,
      result
    });
  } catch (err) {
    sendJson(res, 500, { success: false, error: err.message || 'Delete failed' });
  }
};
