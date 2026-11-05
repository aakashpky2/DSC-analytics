const { run } = require('./dist-server/server/localDb');

async function test() {
  try {
    const res = await run("UPDATE temporary_delegations SET status = 'revoked', revoked_at = ?, revoked_by = ? WHERE parent_delegation_id = ?", [new Date().toISOString(), 'usr-admin-root', 'del-123']);
    console.log('Result:', res);
  } catch(e) {
    console.log('Error:', e.message);
  }
}
test();

