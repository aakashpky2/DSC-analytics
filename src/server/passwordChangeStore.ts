import { getRelationalStore, saveRelationalStore } from './dscMasterStore'

export const STORE_USER_PASSWORD_CHANGE_FLAGS = 'user_password_change_flags'

export interface UserPasswordChangeState {
  user_id: string
  password_change_required: boolean
  temporary_password_set_at?: string
  last_password_changed_at?: string
}

export async function isPasswordChangeRequired(userId: string): Promise<boolean> {
  const flags = await getRelationalStore<UserPasswordChangeState>(STORE_USER_PASSWORD_CHANGE_FLAGS)
  const item = flags.find(f => f.user_id === userId)
  return item ? Boolean(item.password_change_required) : false
}

export async function setPasswordChangeRequired(userId: string, required: boolean): Promise<boolean> {
  const flags = await getRelationalStore<UserPasswordChangeState>(STORE_USER_PASSWORD_CHANGE_FLAGS)
  const idx = flags.findIndex(f => f.user_id === userId)
  if (idx >= 0) {
    flags[idx] = {
      ...flags[idx],
      password_change_required: required,
      ...(required ? { temporary_password_set_at: new Date().toISOString() } : { last_password_changed_at: new Date().toISOString() })
    }
  } else {
    flags.push({
      user_id: userId,
      password_change_required: required,
      ...(required ? { temporary_password_set_at: new Date().toISOString() } : { last_password_changed_at: new Date().toISOString() })
    })
  }
  return await saveRelationalStore(STORE_USER_PASSWORD_CHANGE_FLAGS, flags)
}

