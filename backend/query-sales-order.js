const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.xyxbsebdovvmcmzingmh:Factory%40123232@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres' });
(async () => {
  try {
    await client.connect();
    const res = await client.query("select id, orderNo, branchId, customerId from sales_orders where orderNo = $1", ['SO-GUJ-2026-00001']);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err.stack || err.toString());
    process.exit(1);
  } finally {
    await client.end();
  }
})();
