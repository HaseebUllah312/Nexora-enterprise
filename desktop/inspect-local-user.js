const sqlite3 = require('sqlite3').verbose();
const dbPath = process.argv[2] || 'C:\\Users\\Hasee\\AppData\\Roaming\\nexora-enterprise-desktop\\factory_erp.db';
const userId = process.argv[3] || 'c7c804ae-c3bc-4d07-8977-35242c652128';

console.log('DB:', dbPath);
console.log('User ID:', userId);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('DB open failed:', err.message);
    process.exit(1);
  }

  db.get('select * from users where id = ?', [userId], (err, row) => {
    if (err) {
      console.error('Query failed:', err.message);
    } else if (!row) {
      console.log('User not found locally');
    } else {
      console.log('Local user row:');
      console.log(JSON.stringify(row, null, 2));
    }
    db.close();
  });
});
