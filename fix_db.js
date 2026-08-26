const { Client } = require('pg');

async function fix() {
  const client = new Client({
    connectionString: 'postgresql://postgres:[beswinjo@70]@db.ljvjjemdoobzptbhhmsd.supabase.co:5432/postgres'
  });
  
  try {
    await client.connect();
    await client.query('ALTER TABLE public.replacements ALTER COLUMN previous_holder_duration DROP NOT NULL;');
    console.log('Successfully dropped NOT NULL constraint on previous_holder_duration');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}
fix();
