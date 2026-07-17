const sqlite3 = require('sqlite3').verbose();
const dbPath = process.argv[2] || 'C:\\Users\\Hasee\\AppData\\Roaming\\nexora-enterprise-desktop\\factory_erp.db';
const productId = process.argv[3] || '9e7954d4-25b7-41c5-b770-5c8189613cb8';

console.log('DB:', dbPath);
console.log('Product ID:', productId);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('DB open failed:', err.message);
    process.exit(1);
  }

  db.get('select * from products where id = ?', [productId], (err, row) => {
    if (err) {
      console.error('Query failed:', err.message);
    } else if (!row) {
      console.log('Product not found locally');
    } else {
      console.log('Local product row:');
      console.log(JSON.stringify(row, null, 2));
    }
    db.close();
  });
});
