const sql = "UPDATE temporary_delegations SET status = 'revoked', revoked_at = ?, revoked_by = ? WHERE parent_delegation_id = ?";
const params = ['2026-11-05T08:35:45.138Z', 'usr-admin-root', 'del-123'];
const setMatch = sql.match(/set\s+([\s\S]+?)\s+where/i);
const whereMatch = sql.match(/where\s+([\s\S]+)$/i);
console.log('setMatch:', setMatch[1]);
console.log('whereMatch:', whereMatch[1]);

const setStr = setMatch[1].trim();
const setParts = setStr.split(',').map(s => s.trim());
console.log('setParts:', setParts);
let paramIdx = 0;
const row = {};
for (const sp of setParts) {
  const eqIdx = sp.indexOf('=');
  const col = sp.substring(0, eqIdx).trim();
  if (sp.includes('?')) {
    row[col] = params[paramIdx++];
  } else {
    // Literal like status = 'revoked'
    const literalVal = sp.substring(eqIdx + 1).trim().replace(/^'|'$/g, '');
    row[col] = literalVal;
  }
}
console.log('row:', row, 'paramIdx:', paramIdx);
const whereConditions = whereMatch[1].split(/\s+and\s+/i);
for (const wc of whereConditions) {
  const match = wc.match(/([a-z_0-9\.]+)\s*(=|!=|<>)\s*\?/i);
  console.log('wc:', wc, 'match:', match ? match[1] : null, 'val:', params[paramIdx++]);
}

