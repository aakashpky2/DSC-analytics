const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const db = new sqlite3.Database('data/signsync.db');
db.all("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name", (err, rows) => {
  if (err) throw err;
  const valid = rows.filter(r => r.name !== 'sqlite_sequence' && r.name !== 'test');
  console.log('Total valid tables in SQLite:', valid.length);
  fs.writeFileSync('data/sqlite_schema.sql', valid.map(r => `-- Table: ${r.name}\n${r.sql};\n`).join('\n'));
  console.log('Saved data/sqlite_schema.sql');
  db.close();
});
