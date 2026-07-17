const sqlite3 = require('sqlite3').verbose();

const dbPath = process.argv[2] || 'C:\\Users\\Hasee\\AppData\\Roaming\\nexora-enterprise-desktop\\factory_erp.db';
const checkOrderNo = process.argv[3] || 'SO-GUJ-2026-00001';
const newOrderNo = process.argv[4] || 'SO-GUJ-2026-00002';

console.log('Checking DB:', dbPath);
console.log('Looking for orderNo:', checkOrderNo, 'and', newOrderNo);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Failed to open local SQLite DB:', err.message);
    process.exit(1);
  }

  db.all(
    'select id, orderNo, branchId, customerId from sales_orders where orderNo in (?, ?)',
    [checkOrderNo, newOrderNo],
    (err, rows) => {
      if (err) {
        console.error('Query failed:', err.message);
      } else {
        console.log('sales_orders matching orderNo:');
        console.log(JSON.stringify(rows, null, 2));
      }

      db.all(
        'select id, modelName, recordId, action, synced from _sync_logs where modelName = ? and synced = 0',
        ['SalesOrder'],
        (err2, logs) => {
          if (err2) {
            console.error('Sync log query failed:', err2.message);
          } else {
            console.log('\nPending SalesOrder sync logs:');
            console.log(JSON.stringify(logs, null, 2));
          }
          db.close();
        }
      );
    }
  );
});
