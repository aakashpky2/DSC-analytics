const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('data/signsync.db');

db.serialize(() => {
  console.log('Seeding initial role permissions for non-super roles...');

  const modules = [
    'mod-dashboard', 'mod-users', 'mod-partners', 'mod-dsc',
    'mod-inventory', 'mod-crm', 'mod-services', 'mod-billing', 'mod-courier'
  ];

  // Role Partner Admin (Level 1)
  modules.forEach(m => {
    const isUsers = m === 'mod-users';
    db.run(`
      INSERT OR REPLACE INTO role_module_permissions (id, role_id, module_id, can_view, can_create, can_edit, can_delete, can_export, mask_pii_fields)
      VALUES (?, 'role-partner-admin', ?, 1, 1, 1, 0, 1, 0)
    `, [`rmp-role-partner-admin-${m}`, m]);
  });

  // Role Branch Operations Manager (Level 2)
  modules.forEach(m => {
    const isBillingOrInventory = m === 'mod-billing' || m === 'mod-inventory' || m === 'mod-crm' || m === 'mod-partners' || m === 'mod-dsc' || m === 'mod-services' || m === 'mod-courier';
    db.run(`
      INSERT OR REPLACE INTO role_module_permissions (id, role_id, module_id, can_view, can_create, can_edit, can_delete, can_export, mask_pii_fields)
      VALUES (?, 'role-branch-mgr', ?, 1, ?, ?, 0, 0, 0)
    `, [`rmp-role-branch-mgr-${m}`, m, isBillingOrInventory ? 1 : 0, isBillingOrInventory ? 1 : 0]);
  });

  // Role Senior Operations Executive (Level 3)
  modules.forEach(m => {
    const canCreate = m === 'mod-dsc' || m === 'mod-crm' || m === 'mod-courier';
    db.run(`
      INSERT OR REPLACE INTO role_module_permissions (id, role_id, module_id, can_view, can_create, can_edit, can_delete, can_export, mask_pii_fields)
      VALUES (?, 'role-senior-exec', ?, 1, ?, 0, 0, 0, 0)
    `, [`rmp-role-senior-exec-${m}`, m, canCreate ? 1 : 0]);
  });

  // Role Field Tele-caller (Level 4)
  modules.forEach(m => {
    const isCrm = m === 'mod-crm' || m === 'mod-dashboard';
    db.run(`
      INSERT OR REPLACE INTO role_module_permissions (id, role_id, module_id, can_view, can_create, can_edit, can_delete, can_export, mask_pii_fields)
      VALUES (?, 'role-field-staff', ?, ?, ?, 0, 0, 0, 1)
    `, [`rmp-role-field-staff-${m}`, m, isCrm ? 1 : 0, isCrm ? 1 : 0]);
  });
});

db.close(() => {
  console.log('Seed completed successfully.');
});

