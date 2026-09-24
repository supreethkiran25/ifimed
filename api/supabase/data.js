const { sendJson } = require('../../lib/auth-api');
const { fetchSupabaseStateFromRest, fetchSupabaseStateFromStorage } = require('../../lib/supabase-rest');

module.exports = async (req, res) => {
  try {
    let state = null;
    try {
      state = await fetchSupabaseStateFromRest();
    } catch (e) {}
    if (!state) {
      try { state = await fetchSupabaseStateFromStorage(); } catch (e) {}
    }
    sendJson(res, 200, {
      success: true,
      source: state ? 'supabase_postgres_rest' : 'empty',
      data: state || { banks: [], invoices: [], bills: [], activities: [] }
    });
  } catch (err) {
    sendJson(res, 500, { success: false, error: err.message || 'Load failed' });
  }
};
