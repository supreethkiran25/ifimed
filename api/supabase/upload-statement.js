const { readJsonBody, sendJson } = require('../../lib/auth-api');
const { uploadRawStatementToSupabase } = require('../../lib/supabase-rest');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    sendJson(res, 405, { success: false, error: 'Method not allowed' });
    return;
  }
  try {
    const parsed = await readJsonBody(req);
    const fileName = parsed.fileName || `statement_${Date.now()}.csv`;
    const uploadResult = await uploadRawStatementToSupabase(fileName, parsed.csvContent || '');
    sendJson(res, 200, {
      success: true,
      archivedInSupabase: true,
      storageKey: uploadResult.key,
      fileName: uploadResult.fileName
    });
  } catch (err) {
    sendJson(res, 500, { success: false, error: err.message || 'Upload failed' });
  }
};
