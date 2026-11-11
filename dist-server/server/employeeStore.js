"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STORE_EMPLOYEES = void 0;
exports.getEmployees = getEmployees;
exports.saveEmployee = saveEmployee;
exports.linkEmployeeToUser = linkEmployeeToUser;
const dscMasterStore_1 = require("./dscMasterStore");
const supabase_1 = require("./supabase");
exports.STORE_EMPLOYEES = 'employee_master_directory';
/**
 * Retrieve all employees in the organization.
 * Automatically ensures baseline employees are present if empty.
 */
async function getEmployees(orgId = 'comp-default') {
    let list = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_EMPLOYEES);
    if (!list || list.length === 0) {
        // Seed initial employees based on existing known staff and requirement specifications
        const initialEmployees = [
            {
                id: 'emp-001',
                employee_code: 'EMP-001',
                full_name: 'Rahul Kumar',
                mobile: '9876543210',
                email: 'rahul@signsync.io',
                department: 'Operations',
                designation: 'Operations Executive',
                organization_id: orgId,
                is_active: true,
                user_id: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
            {
                id: 'emp-002',
                employee_code: 'EMP-002',
                full_name: 'Anjali Nair',
                mobile: '9876543220',
                email: 'anjali@signsync.io',
                department: 'Partner Relations',
                designation: 'Partner Coordinator',
                organization_id: orgId,
                is_active: true,
                user_id: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
            {
                id: 'emp-003',
                employee_code: 'EMP-003',
                full_name: 'Pooja Sharma',
                mobile: '9811122233',
                email: 'pooja.sharma@signsync.io',
                department: 'Operations',
                designation: 'Senior Executive',
                organization_id: orgId,
                is_active: true,
                user_id: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
            {
                id: 'emp-004',
                employee_code: 'EMP-004',
                full_name: 'Rohit Verma',
                mobile: '9822233344',
                email: 'rohit.verma@signsync.io',
                department: 'Field Sales',
                designation: 'Field Tele-caller',
                organization_id: orgId,
                is_active: true,
                user_id: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
            {
                id: 'emp-005',
                employee_code: 'EMP-005',
                full_name: 'Suresh Menon',
                mobile: '9833344455',
                email: 'suresh.menon@signsync.io',
                department: 'Branch Operations',
                designation: 'Branch Operations Manager',
                organization_id: orgId,
                is_active: true,
                user_id: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
            {
                id: 'emp-006',
                employee_code: 'EMP-000',
                full_name: 'SignSync Master Admin',
                mobile: '9999988888',
                email: 'admin@signsync.io',
                department: 'Administration',
                designation: 'Super Administrator',
                organization_id: orgId,
                is_active: true,
                user_id: 'usr-admin-root',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }
        ];
        await (0, dscMasterStore_1.saveRelationalStore)(exports.STORE_EMPLOYEES, initialEmployees);
        list = initialEmployees;
    }
    // Cross-reference with user_profiles to ensure user_id links are accurate
    const users = await (0, supabase_1.queryAll)('SELECT id, email FROM user_profiles');
    const emailToUserId = new Map(users.map(u => [u.email.toLowerCase(), u.id]));
    let modified = false;
    for (const emp of list) {
        const linkedUser = emailToUserId.get(emp.email.toLowerCase());
        if (linkedUser && emp.user_id !== linkedUser) {
            emp.user_id = linkedUser;
            modified = true;
        }
        else if (!linkedUser && emp.user_id) {
            // Check if user ID still exists
            const userExists = users.some(u => u.id === emp.user_id);
            if (!userExists) {
                emp.user_id = null;
                modified = true;
            }
        }
    }
    if (modified) {
        await (0, dscMasterStore_1.saveRelationalStore)(exports.STORE_EMPLOYEES, list);
    }
    return list.filter(e => e.organization_id === orgId);
}
/**
 * Add or update an employee
 */
async function saveEmployee(emp) {
    const list = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_EMPLOYEES);
    const idx = list.findIndex(e => e.id === emp.id || (e.employee_code && e.employee_code.toUpperCase() === emp.employee_code.toUpperCase()));
    if (idx >= 0) {
        list[idx] = Object.assign(Object.assign(Object.assign({}, list[idx]), emp), { updated_at: new Date().toISOString() });
    }
    else {
        list.push(emp);
    }
    return await (0, dscMasterStore_1.saveRelationalStore)(exports.STORE_EMPLOYEES, list);
}
/**
 * Link an employee to a user_id
 */
async function linkEmployeeToUser(employeeId, userId, email) {
    const list = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_EMPLOYEES);
    const emp = list.find(e => e.id === employeeId);
    if (!emp)
        return false;
    emp.user_id = userId;
    if (email)
        emp.email = email;
    emp.updated_at = new Date().toISOString();
    return await (0, dscMasterStore_1.saveRelationalStore)(exports.STORE_EMPLOYEES, list);
}
