import { getRelationalStore, saveRelationalStore } from './dscMasterStore'
import { queryAll } from './supabase'

export const STORE_EMPLOYEES = 'employee_master_directory'

export interface EmployeeRecord {
  id: string
  employee_code: string
  full_name: string
  mobile: string
  email: string
  department?: string
  designation?: string
  branch_id?: string
  organization_id: string
  is_active: boolean
  user_id?: string | null // Linked user account in user_profiles
  created_at: string
  updated_at: string
}

/**
 * Retrieve all employees in the organization.
 * Automatically ensures baseline employees are present if empty.
 */
export async function getEmployees(orgId: string = 'comp-default'): Promise<EmployeeRecord[]> {
  let list = await getRelationalStore<EmployeeRecord>(STORE_EMPLOYEES)
  
  if (!list || list.length === 0) {
    // Seed initial employees based on existing known staff and requirement specifications
    const initialEmployees: EmployeeRecord[] = [
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
    ]

    await saveRelationalStore(STORE_EMPLOYEES, initialEmployees)
    list = initialEmployees
  }

  // Cross-reference with user_profiles to ensure user_id links are accurate
  const users = await queryAll<{ id: string; email: string }>('SELECT id, email FROM user_profiles')
  const emailToUserId = new Map(users.map(u => [u.email.toLowerCase(), u.id]))

  let modified = false
  for (const emp of list) {
    const linkedUser = emailToUserId.get(emp.email.toLowerCase())
    if (linkedUser && emp.user_id !== linkedUser) {
      emp.user_id = linkedUser
      modified = true
    } else if (!linkedUser && emp.user_id) {
      // Check if user ID still exists
      const userExists = users.some(u => u.id === emp.user_id)
      if (!userExists) {
        emp.user_id = null
        modified = true
      }
    }
  }

  if (modified) {
    await saveRelationalStore(STORE_EMPLOYEES, list)
  }

  return list.filter(e => e.organization_id === orgId)
}

/**
 * Add or update an employee
 */
export async function saveEmployee(emp: EmployeeRecord): Promise<boolean> {
  const list = await getRelationalStore<EmployeeRecord>(STORE_EMPLOYEES)
  const idx = list.findIndex(e => e.id === emp.id || (e.employee_code && e.employee_code.toUpperCase() === emp.employee_code.toUpperCase()))
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...emp, updated_at: new Date().toISOString() }
  } else {
    list.push(emp)
  }
  return await saveRelationalStore(STORE_EMPLOYEES, list)
}

/**
 * Link an employee to a user_id
 */
export async function linkEmployeeToUser(employeeId: string, userId: string, email?: string): Promise<boolean> {
  const list = await getRelationalStore<EmployeeRecord>(STORE_EMPLOYEES)
  const emp = list.find(e => e.id === employeeId)
  if (!emp) return false
  emp.user_id = userId
  if (email) emp.email = email
  emp.updated_at = new Date().toISOString()
  return await saveRelationalStore(STORE_EMPLOYEES, list)
}

