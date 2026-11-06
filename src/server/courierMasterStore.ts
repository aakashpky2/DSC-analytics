import { supabase } from './supabase'
import { getRelationalStore, saveRelationalStore } from './dscMasterStore'

/**
 * Courier Master Store & Engine
 * Single Source of Truth for Logistics & Shipment Lifecycle
 */

export async function getCourierPartners(): Promise<any[]> {
  const { data } = await supabase.from('courier_partners').select('*').order('company_name', { ascending: true })
  return data || []
}

export async function getShipmentStatuses(): Promise<any[]> {
  const statuses = await getRelationalStore('courier_master_shipment_statuses')
  return statuses.sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
}

export async function getCourierRtoReasons(): Promise<any[]> {
  return await getRelationalStore('courier_master_rto_reasons')
}

export async function getDispatchMethods(): Promise<any[]> {
  return await getRelationalStore('courier_master_dispatch_methods')
}

export async function getPackagingTypes(): Promise<any[]> {
  return await getRelationalStore('courier_master_packaging_types')
}

export async function getSlaSettings(): Promise<any[]> {
  return await getRelationalStore('courier_master_sla_settings')
}

export async function getManifests(): Promise<any[]> {
  return await getRelationalStore('courier_rel_manifests')
}

export async function getMilestones(): Promise<any[]> {
  return await getRelationalStore('courier_rel_milestones')
}

export async function getRtoTasks(): Promise<any[]> {
  return await getRelationalStore('courier_rel_rto_tasks')
}

