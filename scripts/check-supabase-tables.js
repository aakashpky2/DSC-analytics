const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sqlite3 = require('sqlite3').verbose();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const sqlite = new sqlite3.Database('data/signsync.db');

sqlite.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;", async (err, rows) => {
  if (err) throw err;
  const tables = rows.map(r => r.name).filter(t => t !== 'sqlite_sequence' && t !== 'test');
  console.log(`Checking ${tables.length} tables in Supabase...`);
  
  const results = {};
  for (const t of tables) {
    try {
      const { data, error, count } = await supabase.from(t).select('*', { count: 'exact', head: true });
      if (error) {
        results[t] = { exists: false, error: error.message };
      } else {
        // Also get sqlite count
        const sqCount = await new Promise((res) => {
          sqlite.get(`SELECT COUNT(*) as c FROM ${t}`, (e, row) => res(row ? row.c : 0));
        });
        results[t] = { exists: true, supabaseCount: count, sqliteCount: sqCount };
      }
    } catch (e) {
      results[t] = { exists: false, error: e.message };
    }
  }
  console.log(JSON.stringify(results, null, 2));
  sqlite.close();
});

