const sqlite3 = require('sqlite3').verbose();
const dbPath = process.argv[2] || 'C:\\Users\\Hasee\\AppData\\Roaming\\nexora-enterprise-desktop\\factory_erp.db';
const salesOrderId = process.argv[3] || '0746e715-3b3f-4b69-8600-d4e1e887b651';

console.log('DB:', dbPath);
console.log('SalesOrder ID:', salesOrderId);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('DB open failed:', err.message);
    process.exit(1);
  }

  db.all(
    'select id, salesOrderId, productId, quantity, unitPrice, discount from sales_order_items where salesOrderId = ?',
    [salesOrderId],
    (err, rows) => {
      if (err) {
        console.error('Query failed:', err.message);
        db.close();
        return;
      }

      console.log('SalesOrder items:');
      console.log(JSON.stringify(rows, null, 2));

      if (!rows.length) {
        console.log('No sales order items found for this order.');
        db.close();
        return;
      }

      const productIds = [...new Set(rows.map((r) => r.productId))];

      db.all(
        `select id, name, sku, productCode from products where id in (${productIds.map(() => '?').join(',')})`,
        productIds,
        (err2, products) => {
          if (err2) {
            console.error('Product query failed:', err2.message);
          } else {
            console.log('\nProducts referenced by order items:');
            console.log(JSON.stringify(products, null, 2));
          }
          db.close();
        }
      );
    }
  );
});
