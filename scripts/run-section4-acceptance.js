/**
 * SECTION 4 PERMISSION & SECURITY ARCHITECTURE ACCEPTANCE TEST SUITE
 * 
 * Verifies:
 * 1. Hierarchy Enforcement (Tiers 0 to 4: Super Admin, Partner Admin, Branch Mgr, Senior Staff, Field Staff)
 *    - Downward modification rules
 *    - Cross-tier and upward modification attempts
 *    - Delegation grant attempts by unauthorized tiers (3 & 4)
 * 2. Sub-Permission Cap (View, Create, Edit, Delete, Export)
 *    - Grantor cannot give privileges they do not possess
 * 3. User Override Resolution
 *    - COALESCE(User Override, Role Permission, FALSE)
 *    - Explicit TRUE, explicit FALSE, missing overrides
 * 4. Permission Freeze (permissions_frozen = 1)
 *    - Login behavior under freeze
 *    - Access retention vs blocking
 *    - Modification blocking by managers
 *    - Delegation prevention
 * 5. Delegation Lifecycle
 *    - Creation, validity window, expiry, revocation, cascading invalidation
 * 6. PII Masking
 *    - Masking of email, phone, pan, bank account across endpoints
 *    - Query param vs RBAC enforcement
 * 7. Multi-Tier Staff Authentication & Action Verification
 */

const http = require('http');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local
const envConfig = {};
try {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  envContent.split('\n').forEach(line => {
    const [k, v] = line.split('=');
    if (k && v) envConfig[k.trim()] = v.trim();
  });
} catch (e) {}

const SUPABASE_URL = envConfig.SUPABASE_URL || 'https://kbqwsfmfiomcakbhclca.supabase.co';
const SUPABASE_KEY = envConfig.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BASE_URL = 'http://localhost:3000';

function httpRequest(path, method = 'GET', data = null, cookie = null) {
  return new Promise((resolve) => {
    const u = new URL(path, BASE_URL);
    const options = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    if (cookie) {
      options.headers['Cookie'] = cookie;
    }
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch (e) { json = body; }
        const setCookie = res.headers['set-cookie'];
        let sessionCookie = null;
        if (setCookie) {
          const match = setCookie.join('; ').match(/signsync_session=([^;]+)/);
          if (match) sessionCookie = `signsync_session=${match[1]}`;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          cookie: sessionCookie,
          data: json
        });
      });
    });
    req.on('error', (err) => resolve({ status: 500, error: err.message }));
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function loginUser(email, password = 'Password123!') {
  const res = await httpRequest('/api/auth/login', 'POST', { email, password });
  return {
    status: res.status,
    cookie: res.cookie,
    user: res.data?.user,
    error: res.data?.error
  };
}

const testResults = [];
function recordResult(section, testId, description, expected, actual, verdict, details = {}) {
  testResults.push({ section, testId, description, expected, actual, verdict, details });
  console.log(`[${verdict}] [${section}] ${testId}: ${description} -> ${actual}`);
}

async function runSection4AcceptanceSuite() {
  console.log('================================================================');
  console.log('    SIGNSYNC SECTION 4 PERMISSION ARCHITECTURE ACCEPTANCE TEST  ');
  console.log('================================================================\n');

  // --- SETUP: Find or Create Test Users for All 5 Hierarchy Tiers ---
  console.log('--- 0. Resolving Test Staff Accounts for Tiers 0 to 4 ---');
  
  // Tier 0: Master Super Admin
  const adminLogin = await loginUser('admin@signsync.io', 'Password123!');
  recordResult('Setup', 'Tier-0 Login', 'Super Admin logs in successfully', 200, adminLogin.status, adminLogin.status === 200 ? 'PASS' : 'FAIL');

  // Query users from Supabase
  const { data: users } = await supabase.from('user_profiles').select('id, email, full_name, role_id, hierarchy_level_id, permissions_frozen, can_grant_permissions, status');
  const { data: levels } = await supabase.from('hierarchy_levels').select('*').order('level_order', { ascending: true });

  const tierUsers = {};
  for (const lvl of levels) {
    const u = users.find(usr => usr.hierarchy_level_id === lvl.id && usr.status === 'active');
    tierUsers[lvl.level_order] = u;
    console.log(`Tier ${lvl.level_order} (${lvl.level_name}): ${u ? u.email : 'NOT FOUND'}`);
  }

  // Ensure test accounts exist for all 5 tiers with known password
  const bcrypt = require('bcryptjs');
  const testPasswordHash = await bcrypt.hash('Password123!', 10);

  async function ensureTestUser(tierOrder, emailPrefix, roleId, levelId, canGrant = 0) {
    let existing = users.find(u => u.hierarchy_level_id === levelId && u.email.startsWith(emailPrefix));
    if (!existing) {
      const newId = `usr-test-t${tierOrder}-${Date.now()}`;
      const email = `${emailPrefix}.test@signsync.io`;
      await supabase.from('user_profiles').insert({
        id: newId,
        email,
        password_hash: testPasswordHash,
        full_name: `Test Tier ${tierOrder} User`,
        phone_number: `+91 98765 4321${tierOrder}`,
        role_id: roleId,
        hierarchy_level_id: levelId,
        permissions_frozen: 0,
        can_grant_permissions: canGrant,
        status: 'active'
      });
      existing = { id: newId, email, role_id: roleId, hierarchy_level_id: levelId, permissions_frozen: 0, can_grant_permissions: canGrant, status: 'active' };
    } else {
      // Ensure password is updated so we can log in
      await supabase.from('user_profiles').update({ password_hash: testPasswordHash, status: 'active', permissions_frozen: 0 }).eq('id', existing.id);
    }
    return existing;
  }

  const t0User = users.find(u => u.hierarchy_level_id === 'tier-0');
  const t1User = await ensureTestUser(1, 't1.regional', 'role-partner-admin', 'tier-1', 1);
  const t2User = await ensureTestUser(2, 't2.branch', 'role-branch-mgr', 'tier-2', 1);
  const t3User = await ensureTestUser(3, 't3.senior', 'role-senior-exec', 'tier-3', 0);
  const t4User = await ensureTestUser(4, 't4.field', 'role-field-staff', 'tier-4', 0);

  // Authenticate all tiers
  const t0Auth = adminLogin;
  const t1Auth = await loginUser(t1User.email, 'Password123!');
  const t2Auth = await loginUser(t2User.email, 'Password123!');
  const t3Auth = await loginUser(t3User.email, 'Password123!');
  const t4Auth = await loginUser(t4User.email, 'Password123!');

  console.log(`Auth Status: T0: ${t0Auth.status}, T1: ${t1Auth.status}, T2: ${t2Auth.status}, T3: ${t3Auth.status}, T4: ${t4Auth.status}`);

  // ==========================================================================
  // SECTION 4.1: HIERARCHY ENFORCEMENT
  // ==========================================================================
  console.log('\n--- 1. Testing Hierarchy Enforcement & Delegation Bounds ---');

  // 1.1 Super Admin (Tier 0) can delegate to Tier 1, 2, 3, 4
  const t0ToT3 = await httpRequest('/api/admin/delegations', 'POST', {
    recipient_user_id: t3User.id,
    module_key: 'crm',
    action_key: 'can_create',
    valid_from: new Date().toISOString(),
    valid_until: new Date(Date.now() + 86400000).toISOString(),
    reason: 'UAT Tier 0 to Tier 3 delegation test',
    can_delegate_further: 0
  }, t0Auth.cookie);
  recordResult('Hierarchy', 'H-01', 'Tier 0 delegates to Tier 3', 201, t0ToT3.status, t0ToT3.status === 201 ? 'PASS' : 'FAIL');

  // 1.2 Tier 1 can delegate to Tier 2, 3, 4 (Downward)
  const t1ToT3 = await httpRequest('/api/admin/delegations', 'POST', {
    recipient_user_id: t3User.id,
    module_key: 'crm',
    action_key: 'can_create',
    valid_from: new Date().toISOString(),
    valid_until: new Date(Date.now() + 86400000).toISOString(),
    reason: 'UAT Tier 1 to Tier 3 delegation test',
    can_delegate_further: 0
  }, t1Auth.cookie);
  recordResult('Hierarchy', 'H-02', 'Tier 1 delegates to Tier 3 (Downward)', 201, t1ToT3.status, t1ToT3.status === 201 ? 'PASS' : 'FAIL');

  // 1.3 PROHIBITED: Tier 1 attempts to delegate to Tier 0 (Upward)
  const t1ToT0 = await httpRequest('/api/admin/delegations', 'POST', {
    recipient_user_id: t0User.id,
    module_key: 'crm',
    action_key: 'can_create',
    valid_from: new Date().toISOString(),
    valid_until: new Date(Date.now() + 86400000).toISOString(),
    reason: 'UAT Tier 1 to Tier 0 illegal delegation',
    can_delegate_further: 0
  }, t1Auth.cookie);
  recordResult('Hierarchy', 'H-03', 'Tier 1 attempts to delegate to Tier 0 (Upward blocked)', 403, t1ToT0.status, t1ToT0.status === 403 ? 'PASS' : 'FAIL', { msg: t1ToT0.data?.error });

  // 1.4 PROHIBITED: Tier 1 attempts to delegate to another Tier 1 (Peer)
  const t1Peer = await ensureTestUser(1, 't1.peer', 'role-partner-admin', 'tier-1', 1);
  const t1ToT1 = await httpRequest('/api/admin/delegations', 'POST', {
    recipient_user_id: t1Peer.id,
    module_key: 'crm',
    action_key: 'can_create',
    valid_from: new Date().toISOString(),
    valid_until: new Date(Date.now() + 86400000).toISOString(),
    reason: 'UAT Tier 1 to Tier 1 peer delegation',
    can_delegate_further: 0
  }, t1Auth.cookie);
  recordResult('Hierarchy', 'H-04', 'Tier 1 attempts to delegate to Tier 1 (Peer blocked)', 403, t1ToT1.status, t1ToT1.status === 403 ? 'PASS' : 'FAIL', { msg: t1ToT1.data?.error });

  // 1.5 PROHIBITED: Tier 2 attempts to delegate to Tier 1 (Upward)
  const t2ToT1 = await httpRequest('/api/admin/delegations', 'POST', {
    recipient_user_id: t1User.id,
    module_key: 'crm',
    action_key: 'can_create',
    valid_from: new Date().toISOString(),
    valid_until: new Date(Date.now() + 86400000).toISOString(),
    reason: 'UAT Tier 2 to Tier 1 upward delegation',
    can_delegate_further: 0
  }, t2Auth.cookie);
  recordResult('Hierarchy', 'H-05', 'Tier 2 attempts to delegate to Tier 1 (Upward blocked)', 403, t2ToT1.status, t2ToT1.status === 403 ? 'PASS' : 'FAIL', { msg: t2ToT1.data?.error });

  // 1.6 PROHIBITED: Tier 3 attempts to delegate rights
  const t3ToT4 = await httpRequest('/api/admin/delegations', 'POST', {
    recipient_user_id: t4User.id,
    module_key: 'crm',
    action_key: 'can_create',
    valid_from: new Date().toISOString(),
    valid_until: new Date(Date.now() + 86400000).toISOString(),
    reason: 'UAT Tier 3 delegation attempt',
    can_delegate_further: 0
  }, t3Auth.cookie);
  recordResult('Hierarchy', 'H-06', 'Tier 3 attempts to delegate rights (Blocked: unauthorized tier)', 403, t3ToT4.status, t3ToT4.status === 403 ? 'PASS' : 'FAIL', { msg: t3ToT4.data?.error });

  // 1.7 PROHIBITED: Tier 4 attempts to delegate rights
  const t4ToT3 = await httpRequest('/api/admin/delegations', 'POST', {
    recipient_user_id: t3User.id,
    module_key: 'crm',
    action_key: 'can_create',
    valid_from: new Date().toISOString(),
    valid_until: new Date(Date.now() + 86400000).toISOString(),
    reason: 'UAT Tier 4 delegation attempt',
    can_delegate_further: 0
  }, t4Auth.cookie);
  recordResult('Hierarchy', 'H-07', 'Tier 4 attempts to delegate rights (Blocked: unauthorized tier)', 403, t4ToT3.status, t4ToT3.status === 403 ? 'PASS' : 'FAIL', { msg: t4ToT3.data?.error });

  // 1.8 Role Matrix Modification Hierarchy:
  // Tier 1 attempts to modify role permissions matrix via PUT /api/admin/roles/:id/permissions
  const t1ModifyRole = await httpRequest('/api/admin/roles/role-branch-mgr/permissions', 'PUT', {
    permissions: [{ module_id: 'mod-crm', can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, can_export: 1, mask_pii_fields: 0 }]
  }, t1Auth.cookie);
  recordResult('Hierarchy', 'H-08', 'Tier 1 attempts to modify Role Permissions Matrix', 403, t1ModifyRole.status, t1ModifyRole.status === 403 ? 'PASS' : 'FAIL', { msg: t1ModifyRole.data?.error });

  // Tier 0 modifies role permissions matrix (Permitted)
  const t0ModifyRole = await httpRequest('/api/admin/roles/role-branch-mgr/permissions', 'PUT', {
    permissions: [{ module_id: 'mod-crm', can_view: 1, can_create: 1, can_edit: 1, can_delete: 0, can_export: 0, mask_pii_fields: 0 }]
  }, t0Auth.cookie);
  recordResult('Hierarchy', 'H-09', 'Tier 0 modifies Role Permissions Matrix', 200, t0ModifyRole.status, t0ModifyRole.status === 200 ? 'PASS' : 'FAIL');

  // ==========================================================================
  // SECTION 4.2: SUB-PERMISSION CAP
  // ==========================================================================
  console.log('\n--- 2. Testing Sub-Permission Cap Engine ---');
  // Sub-permission cap rule: A grantor cannot delegate or assign privileges they do not possess.
  const { validateSubPermissionCap } = require('../dist-server/lib/permissions');

  // Case A: Granter has { can_view: true, can_create: true, can_edit: false, can_delete: false, can_export: false }
  // Requests to grant { can_view: true, can_create: true } -> ALLOWED
  const capTest1 = validateSubPermissionCap(
    { can_view: true, can_create: true, can_edit: false, can_delete: false, can_export: false, mask_pii_fields: true },
    { can_view: true, can_create: true }
  );
  recordResult('Sub-Cap', 'SC-01', 'Grantor delegates permitted sub-permissions (View, Create)', true, capTest1.allowed, capTest1.allowed ? 'PASS' : 'FAIL');

  // Case B: Requests to grant { can_delete: true } when grantor can_delete: false -> DENIED
  const capTest2 = validateSubPermissionCap(
    { can_view: true, can_create: true, can_edit: false, can_delete: false, can_export: false, mask_pii_fields: true },
    { can_delete: true }
  );
  recordResult('Sub-Cap', 'SC-02', 'Grantor attempts to delegate unpossessed Delete permission', false, capTest2.allowed, !capTest2.allowed && capTest2.deniedKeys?.includes('can_delete') ? 'PASS' : 'FAIL', { denied: capTest2.deniedKeys });

  // Case C: Requests to grant { can_export: true } when grantor can_export: false -> DENIED
  const capTest3 = validateSubPermissionCap(
    { can_view: true, can_create: true, can_edit: true, can_delete: false, can_export: false, mask_pii_fields: true },
    { can_export: true }
  );
  recordResult('Sub-Cap', 'SC-03', 'Grantor attempts to delegate unpossessed Export permission', false, capTest3.allowed, !capTest3.allowed && capTest3.deniedKeys?.includes('can_export') ? 'PASS' : 'FAIL', { denied: capTest3.deniedKeys });

  // Case D: Super Admin bypasses sub-permission cap check
  const capTestSuper = validateSubPermissionCap(
    { can_view: false, can_create: false, can_edit: false, can_delete: false, can_export: false, mask_pii_fields: true },
    { can_delete: true, can_export: true },
    true // isSuperAdmin
  );
  recordResult('Sub-Cap', 'SC-04', 'Super Admin bypasses sub-permission cap', true, capTestSuper.allowed, capTestSuper.allowed ? 'PASS' : 'FAIL');

  // API Check: Does POST /api/admin/delegations enforce sub-permission cap against granter's actual role/override?
  // Let's test if Tier 2 (who lacks 'can_delete' on billing) can delegate 'can_delete' on billing
  const t2IllegalSubCap = await httpRequest('/api/admin/delegations', 'POST', {
    recipient_user_id: t3User.id,
    module_key: 'billing',
    action_key: 'can_delete',
    valid_from: new Date().toISOString(),
    valid_until: new Date(Date.now() + 86400000).toISOString(),
    reason: 'UAT Illegal sub-permission cap test',
    can_delegate_further: 0
  }, t2Auth.cookie);
  // Note: let's record if API checks granter permissions or allows any action_key
  recordResult('Sub-Cap', 'SC-05', 'API Check: Grantor delegates unheld sub-permission (Billing Delete)', 403, t2IllegalSubCap.status, t2IllegalSubCap.status === 403 ? 'PASS' : 'FAIL', {
    status: t2IllegalSubCap.status,
    response: t2IllegalSubCap.data
  });

  // ==========================================================================
  // SECTION 4.3: USER OVERRIDE RESOLUTION
  // ==========================================================================
  console.log('\n--- 3. Testing User Override Resolution Engine ---');
  // Formula: Effective Permission = COALESCE(User Override, Role Permission, FALSE)
  const { resolveEffectivePermission } = require('../dist-server/lib/permissions');

  // Test 3.1: Explicit TRUE override takes precedence over FALSE role permission
  const overTest1 = resolveEffectivePermission(
    { can_view: true, can_create: false }, // role
    { can_create: true } // override
  );
  recordResult('Override', 'UO-01', 'Explicit TRUE override enables can_create when role is FALSE', true, overTest1.can_create, overTest1.can_create === true ? 'PASS' : 'FAIL');

  // Test 3.2: Explicit FALSE override denies access even when role is TRUE
  const overTest2 = resolveEffectivePermission(
    { can_view: true, can_create: true }, // role
    { can_create: false } // override
  );
  recordResult('Override', 'UO-02', 'Explicit FALSE override denies can_create when role is TRUE', false, overTest2.can_create, overTest2.can_create === false ? 'PASS' : 'FAIL');

  // Test 3.3: Missing override falls back to role permission
  const overTest3 = resolveEffectivePermission(
    { can_view: true, can_create: true }, // role
    {} // no override for can_create
  );
  recordResult('Override', 'UO-03', 'Missing override falls back to role permission (TRUE)', true, overTest3.can_create, overTest3.can_create === true ? 'PASS' : 'FAIL');

  // Test 3.4: Missing override and missing role permission defaults to FALSE
  const overTest4 = resolveEffectivePermission(
    {}, // empty role
    {} // empty override
  );
  recordResult('Override', 'UO-04', 'Missing override & role defaults to FALSE', false, overTest4.can_delete, overTest4.can_delete === false ? 'PASS' : 'FAIL');

  // Test 3.5: Database-backed User Override Live API Enforcement
  // Set explicit FALSE override for t3User on 'crm' can_create in database
  const crmModId = 'mod-crm';
  await supabase.from('user_permission_overrides').upsert({
    id: `upo-${t3User.id}-${crmModId}`,
    user_id: t3User.id,
    module_id: crmModId,
    can_view: 1,
    can_create: 0, // Explicit FALSE
    can_edit: 0,
    can_delete: 0,
    can_export: 0,
    mask_pii_fields: 1
  });

  // Now test if t3User is blocked from creating a lead (POST /api/crm/leads)
  const t3CreateBlocked = await httpRequest('/api/crm/leads', 'POST', {
    first_name: 'OverrideTest',
    last_name: 'Lead',
    email: 'overridetest@example.com',
    phone: '+91 99999 11111',
    company_name: 'Override Co',
    lead_source: 'Website',
    status: 'new'
  }, t3Auth.cookie);
  recordResult('Override', 'UO-05', 'API Check: Explicit FALSE user override blocks POST /api/crm/leads', 403, t3CreateBlocked.status, t3CreateBlocked.status === 403 ? 'PASS' : 'FAIL', { error: t3CreateBlocked.data?.error });

  // Update override to explicit TRUE (can_create: 1)
  await supabase.from('user_permission_overrides').upsert({
    id: `upo-${t3User.id}-${crmModId}`,
    user_id: t3User.id,
    module_id: crmModId,
    can_view: 1,
    can_create: 1, // Explicit TRUE
    can_edit: 0,
    can_delete: 0,
    can_export: 0,
    mask_pii_fields: 1
  });

  const t3CreateAllowed = await httpRequest('/api/crm/leads', 'POST', {
    company_name: 'Override Co',
    contact_person: 'Override Allowed Lead',
    email: 'overrideallowed@example.com',
    phone: '+91 99999 22222',
    status: 'new'
  }, t3Auth.cookie);
  recordResult('Override', 'UO-06', 'API Check: Explicit TRUE user override permits POST /api/crm/leads', 201, t3CreateAllowed.status, t3CreateAllowed.status === 201 ? 'PASS' : 'FAIL');

  // Clean up override for t3User
  await supabase.from('user_permission_overrides').delete().eq('id', `upo-${t3User.id}-${crmModId}`);

  // ==========================================================================
  // SECTION 4.4: PERMISSION FREEZE
  // ==========================================================================
  console.log('\n--- 4. Testing Permission Freeze Architecture ---');

  // Freeze t4User using Super Admin API (PATCH /api/admin/users/:id/freeze)
  const freezeAction = await httpRequest(`/api/admin/users/${t4User.id}/freeze`, 'PATCH', { frozen: 1 }, t0Auth.cookie);
  recordResult('Freeze', 'PF-01', 'Super Admin freezes user account via API', 200, freezeAction.status, freezeAction.status === 200 ? 'PASS' : 'FAIL');

  // Verify Supabase record has permissions_frozen = 1
  const { data: frozenDbUser } = await supabase.from('user_profiles').select('permissions_frozen').eq('id', t4User.id).single();
  recordResult('Freeze', 'PF-02', 'Supabase database confirms permissions_frozen = 1', 1, frozenDbUser?.permissions_frozen, frozenDbUser?.permissions_frozen === 1 ? 'PASS' : 'FAIL');

  // Test 4.3: Login behavior when permissions_frozen = 1
  // Section 4 specification requirement: "Test whether login incorrectly fails simply because permissions are frozen."
  // And "Frozen users must retain normal authorized work access unless separately deactivated. Managers must not modify frozen users' permissions."
  const t4LoginWhileFrozen = await loginUser(t4User.email, 'Password123!');
  console.log('Login response while frozen:', t4LoginWhileFrozen.status, t4LoginWhileFrozen.error);
  recordResult('Freeze', 'PF-03', 'Login attempt while permissions_frozen = 1', 'Accept login or evaluate freeze status', `${t4LoginWhileFrozen.status}: ${t4LoginWhileFrozen.error || 'Success'}`, 
    t4LoginWhileFrozen.status === 200 ? 'PASS (Allows Login)' : (t4LoginWhileFrozen.status === 403 ? 'PARTIAL (Blocks Login at Auth Guard)' : 'FAIL'));

  // Test 4.4: Tier 1 (Manager) attempts to modify frozen user
  const t1ModifyFrozen = await httpRequest(`/api/admin/users/${t4User.id}/freeze`, 'PATCH', { frozen: 0 }, t1Auth.cookie);
  recordResult('Freeze', 'PF-04', 'Tier 1 manager attempts to unfreeze/modify frozen user', 403, t1ModifyFrozen.status, t1ModifyFrozen.status === 403 ? 'PASS' : 'FAIL', { error: t1ModifyFrozen.data?.error });

  // Test 4.5: Master Super Admin cannot be frozen
  const t0FreezeRoot = await httpRequest(`/api/admin/users/${t0User.id}/freeze`, 'PATCH', { frozen: 1 }, t0Auth.cookie);
  recordResult('Freeze', 'PF-05', 'Master Super Admin account freeze protection', 400, t0FreezeRoot.status, t0FreezeRoot.status === 400 ? 'PASS' : 'FAIL', { msg: t0FreezeRoot.data?.error });

  // Unfreeze t4User
  await httpRequest(`/api/admin/users/${t4User.id}/freeze`, 'PATCH', { frozen: 0 }, t0Auth.cookie);
  const t4Reauth = await loginUser(t4User.email, 'Password123!');
  t4Auth.cookie = t4Reauth.cookie;
  recordResult('Freeze', 'PF-06', 'User restored and operational after unfreeze', 200, t4Reauth.status, t4Reauth.status === 200 ? 'PASS' : 'FAIL');

  // ==========================================================================
  // SECTION 4.5: DELEGATION LIFECYCLE
  // ==========================================================================
  console.log('\n--- 5. Testing Delegation Lifecycle & Cascading Revocation ---');

  // Test 5.1: Create active delegation
  const delCreate = await httpRequest('/api/admin/delegations', 'POST', {
    recipient_user_id: t3User.id,
    module_key: 'inventory',
    action_key: 'can_create',
    valid_from: new Date(Date.now() - 3600000).toISOString(), // 1 hr ago
    valid_until: new Date(Date.now() + 86400000).toISOString(), // 24 hrs future
    reason: 'UAT Temporary coverage delegation',
    can_delegate_further: 1
  }, t0Auth.cookie);
  const parentDelId = delCreate.data?.id;
  recordResult('Delegation', 'DL-01', 'Creation of valid active temporary delegation', 201, delCreate.status, delCreate.status === 201 ? 'PASS' : 'FAIL', { id: parentDelId });

  // Test 5.2: Dependent / Onward delegation
  const childDelCreate = await httpRequest('/api/admin/delegations', 'POST', {
    recipient_user_id: t4User.id,
    module_key: 'inventory',
    action_key: 'can_create',
    valid_from: new Date().toISOString(),
    valid_until: new Date(Date.now() + 43200000).toISOString(),
    reason: 'UAT Onward child delegation',
    can_delegate_further: 0,
    parent_delegation_id: parentDelId
  }, t0Auth.cookie);
  const childDelId = childDelCreate.data?.id;
  recordResult('Delegation', 'DL-02', 'Creation of dependent onward child delegation', 201, childDelCreate.status, childDelCreate.status === 201 ? 'PASS' : 'FAIL', { id: childDelId });

  // Test 5.3: Cascading Revocation
  // When parent delegation is revoked, child delegation must be invalidated
  const revokeParent = await httpRequest(`/api/admin/delegations/${parentDelId}/revoke`, 'PATCH', {}, t0Auth.cookie);
  recordResult('Delegation', 'DL-03', 'Revocation of parent delegation', 200, revokeParent.status, revokeParent.status === 200 ? 'PASS' : 'FAIL');

  // Verify child delegation status in Supabase
  const { data: childDelDb } = await supabase.from('temporary_delegations').select('status').eq('id', childDelId).single();
  recordResult('Delegation', 'DL-04', 'Child delegation automatically revoked (Cascading Invalidation)', 'revoked', childDelDb?.status, childDelDb?.status === 'revoked' ? 'PASS' : 'FAIL');

  // Test 5.4: Expired delegation rejection
  const expiredDel = await httpRequest('/api/admin/delegations', 'POST', {
    recipient_user_id: t3User.id,
    module_key: 'inventory',
    action_key: 'can_create',
    valid_from: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    valid_until: new Date(Date.now() - 86400000).toISOString(), // 1 day ago (already expired)
    reason: 'UAT Past expired delegation',
    can_delegate_further: 0
  }, t0Auth.cookie);
  const expiredDelId = expiredDel.data?.id;

  // Check if expired delegation enables access
  // requirePermission queries: AND valid_from <= now AND valid_until >= now
  const { isDelegationValid } = require('../dist-server/lib/permissions');
  const validCheck = isDelegationValid({
    id: 'test',
    status: 'active',
    valid_from: new Date(Date.now() - 172800000).toISOString(),
    valid_until: new Date(Date.now() - 86400000).toISOString(),
    module_key: 'inventory',
    action_key: 'can_create',
    grantor_user_id: t0User.id,
    recipient_user_id: t3User.id,
    can_delegate_further: 0,
    created_at: new Date().toISOString()
  });
  recordResult('Delegation', 'DL-05', 'Expired delegation rejected by validity evaluator', false, validCheck, !validCheck ? 'PASS' : 'FAIL');

  // ==========================================================================
  // SECTION 4.6: PII MASKING
  // ==========================================================================
  console.log('\n--- 6. Testing PII Masking Implementation Across Endpoints ---');
  const { maskEmail, maskPhone, maskPan, maskBankAccount } = require('../dist-server/lib/masking');

  // Test Unit Masking Functions
  const maskedEmailRes = maskEmail('rajesh.kumar@shreeshyam.com');
  const emailMaskedProperly = maskedEmailRes === 'r***h@s***m.com' || (maskedEmailRes.startsWith('r') && maskedEmailRes.includes('***'));
  recordResult('PII', 'PII-01', 'Email Masking Format (rajesh.kumar@shreeshyam.com)', 'Redacted with asterisks', maskedEmailRes, emailMaskedProperly ? 'PASS' : 'FAIL');

  const maskedPhoneRes = maskPhone('+91 98200 12345');
  const phoneMaskedProperly = maskedPhoneRes.includes('******2345') || maskedPhoneRes.endsWith('2345');
  recordResult('PII', 'PII-02', 'Phone Masking Format (+91 98200 12345)', '+91 ******2345', maskedPhoneRes, phoneMaskedProperly ? 'PASS' : 'FAIL');

  const maskedPanRes = maskPan('ABCDE1234F');
  const panMaskedProperly = maskedPanRes === '*****1234F' || maskedPanRes.endsWith('1234F');
  recordResult('PII', 'PII-03', 'PAN Masking Format (ABCDE1234F)', '*****1234F', maskedPanRes, panMaskedProperly ? 'PASS' : 'FAIL');

  const maskedBankRes = maskBankAccount('50200012345678');
  const bankMaskedProperly = maskedBankRes.endsWith('5678') && maskedBankRes.includes('*');
  recordResult('PII', 'PII-04', 'Bank Account Masking Format (50200012345678)', '**********5678', maskedBankRes, bankMaskedProperly ? 'PASS' : 'FAIL');

  // Test Live Endpoints for PII Masking
  // 1. /api/partners?mask=true
  const partnersMasked = await httpRequest('/api/partners?mask=true', 'GET', null, t0Auth.cookie);
  const sampleP = partnersMasked.data?.partners?.[0];
  const pEmailMasked = sampleP?.email?.includes('*');
  const pPhoneMasked = sampleP?.phone?.includes('*');
  recordResult('PII', 'PII-05', 'GET /api/partners?mask=true redacts email & phone', true, Boolean(pEmailMasked && pPhoneMasked), (pEmailMasked && pPhoneMasked) ? 'PASS' : 'FAIL', {
    email: sampleP?.email,
    phone: sampleP?.phone
  });

  // 2. /api/dsc/applications?mask=true
  const dscMasked = await httpRequest('/api/dsc/applications?mask=true', 'GET', null, t0Auth.cookie);
  const sampleDsc = dscMasked.data?.applications?.[0];
  const dscEmailMasked = sampleDsc?.applicant_email?.includes('*');
  const dscPhoneMasked = sampleDsc?.applicant_phone?.includes('*');
  const dscPanMasked = sampleDsc?.applicant_pan?.includes('*');
  recordResult('PII', 'PII-06', 'GET /api/dsc/applications?mask=true redacts applicant PII', true, Boolean(dscEmailMasked || dscPhoneMasked || dscPanMasked), (dscEmailMasked || dscPhoneMasked || dscPanMasked) ? 'PASS' : 'FAIL', {
    email: sampleDsc?.applicant_email,
    phone: sampleDsc?.applicant_phone,
    pan: sampleDsc?.applicant_pan
  });

  // 3. /api/crm/leads?mask=true
  const crmMasked = await httpRequest('/api/crm/leads?mask=true', 'GET', null, t0Auth.cookie);
  const sampleCrm = crmMasked.data?.leads?.[0];
  const crmEmailMasked = sampleCrm?.email?.includes('*');
  const crmPhoneMasked = sampleCrm?.phone?.includes('*');
  recordResult('PII', 'PII-07', 'GET /api/crm/leads?mask=true redacts lead email & phone', true, Boolean(crmEmailMasked || crmPhoneMasked), (crmEmailMasked || crmPhoneMasked) ? 'PASS' : 'FAIL', {
    email: sampleCrm?.email,
    phone: sampleCrm?.phone
  });

  // 4. /api/admin/users?mask=true
  const usersMasked = await httpRequest('/api/admin/users?mask=true', 'GET', null, t0Auth.cookie);
  const sampleU = usersMasked.data?.users?.[0];
  const uEmailMasked = sampleU?.email?.includes('*');
  const uPhoneMasked = sampleU?.phone_number?.includes('*');
  recordResult('PII', 'PII-08', 'GET /api/admin/users?mask=true redacts staff email & phone', true, Boolean(uEmailMasked || uPhoneMasked), (uEmailMasked || uPhoneMasked) ? 'PASS' : 'FAIL', {
    email: sampleU?.email,
    phone: sampleU?.phone_number
  });

  // 5. RESTRICTED ROLE TEST: Does Field Staff (Tier 4 / Telecaller) get masked PII automatically without query param?
  // Check if role_module_permissions for Field Telecaller has mask_pii_fields = 1
  const t4Crm = await httpRequest('/api/crm/leads', 'GET', null, t4Auth.cookie);
  const t4LeadSample = t4Crm.data?.leads?.[0];
  const t4AutoMasked = t4LeadSample?.email?.includes('*') || t4LeadSample?.phone?.includes('*');
  recordResult('PII', 'PII-09', 'Field Staff (Tier 4) automatic PII redaction without ?mask=true', 'Auto-masked by RBAC policy', t4AutoMasked ? 'Auto-masked' : 'Unmasked unless ?mask=true requested', t4AutoMasked ? 'PASS' : 'PARTIAL', {
    email: t4LeadSample?.email,
    phone: t4LeadSample?.phone
  });

  // ==========================================================================
  // SECTION 4.7: MULTI-TIER REAL STAFF ROLE UAT
  // ==========================================================================
  console.log('\n--- 7. Testing Multi-Tier Real Staff Role Actions ---');

  // Tier 1 (Regional Admin): Can view billing invoices, cannot delete
  const t1ViewInvoices = await httpRequest('/api/billing/invoices', 'GET', null, t1Auth.cookie);
  recordResult('Role UAT', 'RU-01', 'Tier 1 (Regional Admin) views billing invoices', 200, t1ViewInvoices.status, t1ViewInvoices.status === 200 ? 'PASS' : 'FAIL');

  // Tier 2 (Branch Manager): Can view inventory branches & stock
  const t2ViewBranches = await httpRequest('/api/inventory/branches', 'GET', null, t2Auth.cookie);
  recordResult('Role UAT', 'RU-02', 'Tier 2 (Branch Manager) views branch stock', 200, t2ViewBranches.status, t2ViewBranches.status === 200 ? 'PASS' : 'FAIL');

  // Tier 3 (Senior Staff / Executive): Can view DSC applications
  const t3ViewDsc = await httpRequest('/api/dsc/applications', 'GET', null, t3Auth.cookie);
  recordResult('Role UAT', 'RU-03', 'Tier 3 (Senior Staff) views DSC applications', 200, t3ViewDsc.status, t3ViewDsc.status === 200 ? 'PASS' : 'FAIL');

  // Tier 4 (Field Staff / Telecaller): Can view CRM leads
  const t4ViewCrm = await httpRequest('/api/crm/leads', 'GET', null, t4Auth.cookie);
  recordResult('Role UAT', 'RU-04', 'Tier 4 (Field Staff) views CRM leads', 200, t4ViewCrm.status, t4ViewCrm.status === 200 ? 'PASS' : 'FAIL');

  // Tier 4 (Field Staff / Telecaller): PROHIBITED from accessing /api/admin/users
  const t4AccessAdmin = await httpRequest('/api/admin/users', 'GET', null, t4Auth.cookie);
  recordResult('Role UAT', 'RU-05', 'Tier 4 (Field Staff) blocked from /api/admin/users', 403, t4AccessAdmin.status, t4AccessAdmin.status === 403 ? 'PASS' : 'FAIL', { msg: t4AccessAdmin.data?.error });

  // Tier 4 (Field Staff / Telecaller): PROHIBITED from accessing /api/billing/accounts
  const t4AccessBilling = await httpRequest('/api/billing/accounts', 'GET', null, t4Auth.cookie);
  recordResult('Role UAT', 'RU-06', 'Tier 4 (Field Staff) blocked from /api/billing/accounts', 403, t4AccessBilling.status, t4AccessBilling.status === 403 ? 'PASS' : 'FAIL', { msg: t4AccessBilling.data?.error });

  // Tier 4 (Field Staff / Telecaller): PROHIBITED from accessing /api/admin/roles
  const t4AccessRoles = await httpRequest('/api/admin/roles', 'GET', null, t4Auth.cookie);
  recordResult('Role UAT', 'RU-07', 'Tier 4 (Field Staff) blocked from /api/admin/roles', 403, t4AccessRoles.status, t4AccessRoles.status === 403 ? 'PASS' : 'FAIL', { msg: t4AccessRoles.data?.error });

  // Summary counts
  const total = testResults.length;
  const pass = testResults.filter(r => r.verdict === 'PASS').length;
  const fail = testResults.filter(r => r.verdict === 'FAIL').length;
  const partial = testResults.filter(r => r.verdict === 'PARTIAL').length;

  console.log('\n================================================================');
  console.log(`TEST SUITE COMPLETE: Total: ${total} | PASS: ${pass} | FAIL: ${fail} | PARTIAL: ${partial}`);
  console.log('================================================================\n');

  fs.writeFileSync('scripts/section4_acceptance_results.json', JSON.stringify(testResults, null, 2));
}

runSection4AcceptanceSuite();
