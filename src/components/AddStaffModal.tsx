'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { X, UserPlus, ShieldAlert, CheckCircle2 } from 'lucide-react'
import {
  validateEmployeeName,
  validateCompanyEmail,
  validateMobileNumber,
  validateInitialPassword,
} from '@/lib/staffValidation'

interface AddStaffModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const INITIAL_FORM_STATE = {
  full_name: '',
  email: '',
  phone_number: '',
  hierarchy_level_id: 'tier-4',
  role_id: 'role-field-staff',
  initial_password: '',
}

export function AddStaffModal({ isOpen, onClose, onSuccess }: AddStaffModalProps) {
  const [formData, setFormData] = useState(INITIAL_FORM_STATE)

  // Field-specific validation errors for instant UX feedback
  const [fieldErrors, setFieldErrors] = useState<{
    full_name?: string
    email?: string
    phone_number?: string
    initial_password?: string
  }>({})

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Clean form reset function
  const resetForm = useCallback(() => {
    setFormData(INITIAL_FORM_STATE)
    setFieldErrors({})
    setError('')
    setSuccessMsg('')
    setLoading(false)
  }, [])

  // Whenever the modal opens or closes, reset the form completely to fresh state
  useEffect(() => {
    if (isOpen) {
      resetForm()
    } else {
      resetForm()
    }
  }, [isOpen, resetForm])

  // Explicit close handler
  const handleClose = () => {
    resetForm()
    onClose()
  }

  if (!isOpen) return null

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tier = e.target.value
    let roleId = 'role-field-staff'
    if (tier === 'tier-1') roleId = 'role-partner-admin'
    if (tier === 'tier-2') roleId = 'role-branch-mgr'
    if (tier === 'tier-3') roleId = 'role-senior-exec'
    if (tier === 'tier-4') roleId = 'role-field-staff'

    setFormData((prev) => ({
      ...prev,
      hierarchy_level_id: tier,
      role_id: roleId,
    }))
  }

  // Handle mobile input with strict 10-digit limit and digit-only filter
  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    // Strip non-digit characters
    const digitsOnly = val.replace(/\D/g, '')
    // Prevent entering more than 10 digits
    const truncated = digitsOnly.slice(0, 10)

    setFormData((prev) => {
      // Auto-sync initial password if password is empty or was matching previous phone
      const shouldSyncPassword = !prev.initial_password || prev.initial_password === prev.phone_number
      return {
        ...prev,
        phone_number: truncated,
        initial_password: shouldSyncPassword ? truncated : prev.initial_password,
      }
    })

    if (fieldErrors.phone_number) {
      setFieldErrors((prev) => ({ ...prev, phone_number: undefined }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    // 1. Frontend Validation
    const nameResult = validateEmployeeName(formData.full_name)
    const emailResult = validateCompanyEmail(formData.email)
    const mobileResult = validateMobileNumber(formData.phone_number)
    const passwordResult = validateInitialPassword(formData.initial_password)

    const newErrors: {
      full_name?: string
      email?: string
      phone_number?: string
      initial_password?: string
    } = {}

    if (!nameResult.valid) newErrors.full_name = nameResult.error
    if (!emailResult.valid) newErrors.email = emailResult.error
    if (!mobileResult.valid) newErrors.phone_number = mobileResult.error
    if (!passwordResult.valid) newErrors.initial_password = passwordResult.error

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors)
      return
    }

    setFieldErrors({})
    setLoading(true)

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: nameResult.name,
          email: emailResult.email,
          phone_number: mobileResult.mobile,
          hierarchy_level_id: formData.hierarchy_level_id,
          role_id: formData.role_id,
          initial_password: passwordResult.password,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        // Status code specific handling
        if (res.status === 409) {
          setError(data.error || 'A staff member with this email or mobile already exists.')
        } else if (res.status === 400) {
          setError(data.error || 'Please correct the invalid fields and try again.')
        } else if (res.status === 403) {
          setError(data.error || 'You do not have permission to create this user.')
        } else {
          setError(data.error || 'Failed to create staff account. Please try again.')
        }
        return
      }

      setSuccessMsg('Staff account created successfully!')
      setTimeout(() => {
        onSuccess()
        handleClose()
      }, 700)
    } catch {
      setError('A network error occurred. Please try again.')
    } finally {
      // Requirement: The loading state must ALWAYS be reset in a finally block
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-xs space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Add New Staff Member</h3>
              <p className="text-[11px] text-slate-400">Set up login credentials and role level for office staff</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2 animate-in fade-in">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5" noValidate autoComplete="off">
          {/* Employee Full Name */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">Employee Full Name *</label>
            <input
              type="text"
              autoComplete="off"
              placeholder="e.g. Ramesh Kumar"
              value={formData.full_name}
              onChange={(e) => {
                setFormData({ ...formData, full_name: e.target.value })
                if (fieldErrors.full_name) setFieldErrors({ ...fieldErrors, full_name: undefined })
              }}
              className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none transition ${
                fieldErrors.full_name ? 'border-red-500 focus:border-red-500' : 'border-slate-800 focus:border-indigo-500'
              }`}
            />
            {fieldErrors.full_name && (
              <p className="text-[11px] text-red-400 mt-1">{fieldErrors.full_name}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Company Email */}
            <div>
              <label className="block text-slate-300 font-medium mb-1">Company Email *</label>
              <input
                type="email"
                autoComplete="off"
                placeholder="name@company.com"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value })
                  if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined })
                }}
                className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none transition ${
                  fieldErrors.email ? 'border-red-500 focus:border-red-500' : 'border-slate-800 focus:border-indigo-500'
                }`}
              />
              {fieldErrors.email && (
                <p className="text-[11px] text-red-400 mt-1">{fieldErrors.email}</p>
              )}
            </div>

            {/* Mobile Number */}
            <div>
              <label className="block text-slate-300 font-medium mb-1">Mobile Number *</label>
              <input
                type="tel"
                autoComplete="off"
                placeholder="10-digit number"
                maxLength={10}
                value={formData.phone_number}
                onChange={handleMobileChange}
                className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none font-mono transition ${
                  fieldErrors.phone_number ? 'border-red-500 focus:border-red-500' : 'border-slate-800 focus:border-indigo-500'
                }`}
              />
              {fieldErrors.phone_number && (
                <p className="text-[11px] text-red-400 mt-1">{fieldErrors.phone_number}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Access Level */}
            <div>
              <label className="block text-slate-300 font-medium mb-1">Access Level *</label>
              <select
                value={formData.hierarchy_level_id}
                onChange={handleRoleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="tier-1">Level 1 - Regional Partner Admin</option>
                <option value="tier-2">Level 2 - Branch Manager</option>
                <option value="tier-3">Level 3 - Operations Executive</option>
                <option value="tier-4">Level 4 - Field Staff / Tele-caller</option>
              </select>
            </div>

            {/* Initial Password */}
            <div>
              <label className="block text-slate-300 font-medium mb-1">Initial Password *</label>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={formData.initial_password}
                onChange={(e) => {
                  setFormData({ ...formData, initial_password: e.target.value })
                  if (fieldErrors.initial_password) setFieldErrors({ ...fieldErrors, initial_password: undefined })
                }}
                className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none font-mono transition ${
                  fieldErrors.initial_password ? 'border-red-500 focus:border-red-500' : 'border-slate-800 focus:border-indigo-500'
                }`}
              />
              {fieldErrors.initial_password && (
                <p className="text-[11px] text-red-400 mt-1">{fieldErrors.initial_password}</p>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/20 disabled:opacity-50 transition flex items-center gap-1.5"
            >
              {loading ? 'Creating...' : 'Create Staff Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
