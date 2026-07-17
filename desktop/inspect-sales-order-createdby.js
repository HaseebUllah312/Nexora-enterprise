const sqlite3 = require('sqlite3').verbose();
const dbPath = process.argv[2] || 'C:\\Users\\Hasee\\AppData\\Roaming\\nexora-enterprise-desktop\\factory_erp.db';
const orderId = process.argv[3] || '0746e715-3b3f-4b69-8600-d4e1e887b651';

console.log('DB:', dbPath);
console.log('SalesOrder ID:', orderId);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('DB open failed:', err.message);
    process.exit(1);
  }

  db.get(
    'select id, orderNo, branchId, customerId, createdById from sales_orders where id = ?',
    [orderId],
    (err, row) => {
      if (err) {
        console.error('Query failed:', err.message);
      } else if (!row) {
        console.log('SalesOrder not found');
      } else {
        console.log('SalesOrder row:');
        console.log(JSON.stringify(row, null, 2));
      }
      db.close();
    }
  );
});
