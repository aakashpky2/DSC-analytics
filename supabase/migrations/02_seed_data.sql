-- SignSync B2B Enterprise Platform - Initial Seed Data
-- Tiers, Roles, Modules, Permissions, and Default Accounts

-- 1. Hierarchy Levels (0 to 4)
INSERT INTO hierarchy_levels (level_order, level_name, can_delegate_default) VALUES
(0, 'Super Admin', TRUE),
(1, 'Partner / Regional Admin', TRUE),
(2, 'Operations / Branch Manager', TRUE),
(3, 'Senior Staff / Executive', FALSE),
(4, 'Field Staff / Tele-caller', FALSE)
ON CONFLICT (level_order) DO UPDATE SET level_name = EXCLUDED.level_name;

-- 2. System Roles
INSERT INTO roles (name, hierarchy_level_id, description) VALUES
('Super Administrator', (SELECT id FROM hierarchy_levels WHERE level_order = 0), 'Unrestricted master system administrator'),
('Regional Partner Admin', (SELECT id FROM hierarchy_levels WHERE level_order = 1), 'Administer partner network, pricing slabs, and sub-partners'),
('Branch Operations Manager', (SELECT id FROM hierarchy_levels WHERE level_order = 2), 'Oversees branch inventory, payment verification, and CRM pipelines'),
('Senior Operations Executive', (SELECT id FROM hierarchy_levels WHERE level_order = 3), 'Processes DSC applications, invoices, and waybills'),
('Field Tele-caller', (SELECT id FROM hierarchy_levels WHERE level_order = 4), 'Executes lead follow-ups and customer updates with masked PII')
ON CONFLICT (name) DO NOTHING;

-- 3. App Modules
INSERT INTO app_modules (module_key, display_name, route_path) VALUES
('dashboard', 'Executive Dashboard', '/'),
('admin_users', 'User Administration & RBAC', '/admin/users'),
('partners', 'Partner Network', '/partners'),
('dsc', 'DSC Catalogue & Pipeline', '/dsc/catalog'),
('inventory', 'Token Inventory & Landed Cost', '/inventory/tokens'),
('crm', 'CRM Leads & Deduplication', '/crm/leads'),
('services', 'Business Services Hub', '/services'),
('billing', 'Multi-Account Billing & Ledger', '/billing/invoices'),
('courier', 'Courier & POD Tracking', '/courier')
ON CONFLICT (module_key) DO UPDATE SET display_name = EXCLUDED.display_name, route_path = EXCLUDED.route_path;

-- 4. Initial Branch
INSERT INTO branches (branch_name, branch_code, city, state_code) VALUES
('Headquarters - Mumbai', 'HQ-MUM', 'Mumbai', 'MH'),
('Regional Branch - Delhi', 'BR-DEL', 'New Delhi', 'DL')
ON CONFLICT (branch_code) DO NOTHING;

-- 5. Seed Super Admin Profile (if none exists)
INSERT INTO user_profiles (email, full_name, phone_number, role_id, hierarchy_level_id, can_grant_permissions, permissions_frozen, status)
VALUES (
    'admin@signsync.io',
    'SignSync Master Admin',
    '+91 99999 88888',
    (SELECT id FROM roles WHERE name = 'Super Administrator'),
    (SELECT id FROM hierarchy_levels WHERE level_order = 0),
    TRUE,
    FALSE,
    'active'
)
ON CONFLICT (email) DO NOTHING;

