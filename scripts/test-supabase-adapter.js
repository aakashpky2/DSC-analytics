const { queryAll, queryOne, run } = require('../dist-server/server/supabaseDb');

async function testSupabaseAdapter() {
  console.log('--- Testing queryAll ---');
  const partners = await queryAll('SELECT * FROM partners ORDER BY company_name ASC LIMIT 2');
  console.log('Partners count:', partners.length, partners.map(p => p.company_name));

  console.log('\n--- Testing queryOne ---');
  const admin = await queryOne('SELECT * FROM user_profiles WHERE email = ?', ['admin@signsync.io']);
  console.log('Admin user found:', admin ? admin.full_name : null);

  console.log('\n--- Testing run update ---');
  await run('UPDATE branches SET city = ? WHERE id = ?', ['Mumbai Metropolis', 'branch-hq']);
  const branch = await queryOne('SELECT * FROM branches WHERE id = ?', ['branch-hq']);
  console.log('Branch updated city:', branch?.city);

  // Restore
  await run('UPDATE branches SET city = ? WHERE id = ?', ['Mumbai', 'branch-hq']);
  console.log('Branch restored successfully!');
}

testSupabaseAdapter();

