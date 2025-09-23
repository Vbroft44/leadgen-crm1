// data.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Fetch leads (includes OpenPhone fields)
export async function fetchLeads() {
  const { data, error } = await supabase
    .from('leads')
    .select(`
      id,
      customer_name,
      phone,
      phone_e164,
      email,
      address,
      service_needed,
      status,
      appointment_date,
      appointment_time,
      technician,
      notes,
      created_at,
      updated_at,
      first_contact_at,
      inbound_line_name,
      openphone_conversation_url
    `)
    .order('id', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Add a lead (manual add from modal)
export async function addLead(payload: {
  customer_name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  service_needed: string;
  status: string;
  appointment_date?: string | null;
  appointment_time?: string | null;
  technician?: string | null;
  notes?: string | null;
}) {
  const { data, error } = await supabase
    .from('leads')
    .insert(payload)
    .select('id')
    .single();

  if (error) throw error;
  return data!;
}

// Update a lead
export async function updateLead(id: number, updates: any) {
  const { error } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

// Delete a lead
export async function deleteLead(id: number) {
  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Technicians list (unchanged)
export async function fetchTechnicians() {
  const { data, error } = await supabase
    .from('technicians')
    .select('name, trade')
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}
