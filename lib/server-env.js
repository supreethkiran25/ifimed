const fs = require('fs');
const path = require('path');

function loadEnvFile() {
  const candidates = [
    path.join(__dirname, '..', '.env.local'),
    path.join(__dirname, '..', '.env')
  ];
  candidates.forEach(filePath => {
    if (!fs.existsSync(filePath)) return;
    fs.readFileSync(filePath, 'utf8').split(/\r?\n/).forEach(line => {
      const trimmed = String(line || '').trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq < 1) return;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && process.env[key] == null) process.env[key] = value;
    });
  });
}

loadEnvFile();

function presentSupabaseEnvNames() {
  return Object.keys(process.env)
    .filter(key => /supabase/i.test(key))
    .sort();
}

function getSupabaseConfig() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const refFromUrl = url.replace(/^https?:\/\//, '').split('.')[0];
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SERVICE_KEY
    || process.env.SUPABASE_ANON_KEY
    || '';
  return {
    url,
    projectRef: process.env.SUPABASE_PROJECT_REF || refFromUrl || '',
    serviceKey,
    anonKey: process.env.SUPABASE_ANON_KEY || ''
  };
}

function assertSupabaseConfig() {
  const cfg = getSupabaseConfig();
  if (!cfg.projectRef || !cfg.serviceKey) {
    const seen = presentSupabaseEnvNames();
    throw new Error(
      'Supabase is not configured on the server. Set SUPABASE_PROJECT_REF and SUPABASE_SERVICE_ROLE_KEY, then Redeploy. '
      + (seen.length ? `Visible env names: ${seen.join(', ')}.` : 'No SUPABASE_* env vars are visible to this deployment.')
    );
  }
  return cfg;
}

module.exports = { loadEnvFile, getSupabaseConfig, assertSupabaseConfig };
