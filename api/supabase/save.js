const { readJsonBody, sendJson } = require('../../lib/auth-api');
const { saveToSupabaseRestTables, saveSupabaseStorageSnapshot } = require('../../lib/supabase-rest');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    sendJson(res, 405, { success: false, error: 'Method not allowed' });
    return;
  }
  try {
    const parsed = await readJsonBody(req);
    const hasBanks = Array.isArray(parsed.banks) && parsed.banks.length > 0;
    const hasTxns = Array.isArray(parsed.transactions) && parsed.transactions.length > 0;
    const hasDeletes = Array.isArray(parsed.deletedSheets) && parsed.deletedSheets.length > 0;
    if (!hasBanks && !hasTxns && !hasDeletes) {
      sendJson(res, 400, { success: false, error: 'Save payload is empty. No banks or transactions were received.' });
      return;
    }
    parsed.updatedAt = new Date().toISOString();
    parsed.updatedBy = 'IFIMED Treasury User';
    const restSync = await saveToSupabaseRestTables(parsed);
    saveSupabaseStorageSnapshot(parsed).catch(() => {});
    sendJson(res, 200, {
      success: true,
      syncedTo: 'supabase_postgres_tables',
      restSync,
      timestamp: parsed.updatedAt
    });
  } catch (err) {
    sendJson(res, 500, { success: false, error: err.message || 'Save failed' });
  }
};
