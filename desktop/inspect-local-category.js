const sqlite3 = require('sqlite3').verbose();
const dbPath = process.argv[2] || 'C:\\Users\\Hasee\\AppData\\Roaming\\nexora-enterprise-desktop\\factory_erp.db';
const categoryId = process.argv[3] || 'ab5f972f-e4d1-4e63-82e4-b41edcb8b635';

console.log('DB:', dbPath);
console.log('Category ID:', categoryId);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('DB open failed:', err.message);
    process.exit(1);
  }

  db.get('select * from categories where id = ?', [categoryId], (err, row) => {
    if (err) {
      console.error('Query failed:', err.message);
    } else if (!row) {
      console.log('Category not found locally');
    } else {
      console.log('Local category row:');
      console.log(JSON.stringify(row, null, 2));
    }
    db.close();
  });
});
