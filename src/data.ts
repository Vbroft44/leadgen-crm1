// ./data.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

// ---- Leads ----

export async function fetchLeads() {
  const { data, error } = await supabase
    .from("leads")
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
      inbound_line_number,
      openphone_conversation_url,
      deleted_at
    `)
    .is("deleted_at", null) // hide soft-deleted
    .order("first_contact_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

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
    .from("leads")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function updateLead(id: number, updates: Record<string, any>) {
  const { error } = await supabase
    .from("leads")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteLead(id: number) {
  const { error } = await supabase
    .from("leads")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ---- Technicians ----

export async function fetchTechnicians() {
  const { data, error } = await supabase
    .from("technicians")
    .select("name, trade")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
