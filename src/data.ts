
import { supabase } from './lib.supabase'

export type Lead = {
  id: number
  customer_name: string
  phone: string
  email: string | null
  address: string | null
  service_needed: string
  status: string
  appointment_date: string | null
  appointment_time: string | null
  technician: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export async function fetchLeads() {
  const { data, error } = await supabase.from('leads').select('*').order('updated_at', { ascending: false })
  if (error) throw error
  return data as Lead[]
}

export async function addLead(payload: Partial<Lead>) {
  const { data, error } = await supabase.from('leads').insert(payload).select().single()
  if (error) throw error
  return data as Lead
}

export async function updateLead(id: number, payload: Partial<Lead>) {
  const { data, error } = await supabase.from('leads').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data as Lead
}

// Technicians
export type Technician = { id: number, name: string, trade: string }
export async function fetchTechnicians() {
  const { data, error } = await supabase.from('technicians').select('*').order('name')
  if (error) throw error
  return data as Technician[]
}
