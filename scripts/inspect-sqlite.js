const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('data/signsync.db');

db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;", (err, rows) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(JSON.stringify(rows.map(r => r.name), null, 2));
  db.close();
});

