const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.xyxbsebdovvmcmzingmh:Factory%40123232@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres' });
(async () => {
  try {
    await client.connect();
    const res = await client.query('select id, name, code from branches where id = $1', ['e2958be4-3adf-440a-95dc-527ebf2cb395']);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
