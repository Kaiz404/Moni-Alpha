const { readFileSync } = require('fs');
const { Client } = require('pg');

async function main() {
  const sql = readFileSync('../../supabase/migrations/20260321000000_seed_visual_transactions_touch_n_go.sql', 'utf8');

  // Connection string (provided)
  const connectionString = 'postgresql://postgres:Tnhzha\\402004@db.yucjcjquwpwkgowzthhn.supabase.co:5432/postgres';

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Connected to DB, running seed SQL...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Seed SQL executed successfully.');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Error executing seed SQL:', err);
    process.exitCode = 2;
  } finally {
    await client.end();
  }
}

main();
