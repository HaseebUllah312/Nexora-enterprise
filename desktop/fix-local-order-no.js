const sqlite3 = require('sqlite3').verbose();

const dbPath = process.argv[2] || 'C:\\Users\\Hasee\\AppData\\Roaming\\nexora-enterprise-desktop\\factory_erp.db';
const orderId = process.argv[3] || '0746e715-3b3f-4b69-8600-d4e1e887b651';
const newOrderNo = process.argv[4] || 'SO-GUJ-2026-00002';

console.log('Using DB:', dbPath);
console.log('Updating order id:', orderId);
console.log('New orderNo:', newOrderNo);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('Failed to open local SQLite DB:', err.message);
    process.exit(1);
  }

  const sql = 'update sales_orders set "orderNo" = ? where id = ?';
  db.run(sql, [newOrderNo, orderId], function (err) {
    if (err) {
      console.error('Update failed:', err.message);
      process.exit(1);
    }

    console.log('Updated rows:', this.changes);
    if (this.changes === 0) {
      console.warn('No rows were updated. Check that the order id exists in the local database.');
    }
    db.close();
  });
});
