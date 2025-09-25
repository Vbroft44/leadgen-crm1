// src/pages/api/openphone-sync-lines.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const OPENPHONE_API_KEY = process.env.OPENPHONE_API_KEY || '';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!OPENPHONE_API_KEY) {
    return res.status(500).json({ error: 'Missing OPENPHONE_API_KEY' });
  }

  // 1) Fetch numbers from OpenPhone
  const resp = await fetch('https://api.openphone.com/v1/phone-numbers', {
    headers: { Authorization: `Bearer ${OPENPHONE_API_KEY}` },
  });

  const bodyText = await resp.text();
  if (!resp.ok) {
    return res.status(resp.status).json({ error: 'OpenPhone API error', body: bodyText });
  }

  let payload: any;
  try { payload = JSON.parse(bodyText); } catch { payload = bodyText; }

  const list: any[] = Array.isArray(payload)
    ? payload
    : payload?.data || payload?.phoneNumbers || [];

  // 2) Shape rows for op_lines (do NOT include "enabled")
  const rows = list.map(n => ({
    phone_e164: n.e164 || n.number || n.phoneNumber || '',
    display_name: n.name || n.friendlyName || n.label || n.displayName || '',
    openphone_id: n.id ?? n.numberId ?? n.sid ?? null,
  })).filter(r => r.phone_e164);

  if (rows.length === 0) {
    return res.status(200).json({ ok: true, message: 'No numbers found to sync.' });
  }

  // 3) Upsert by phone_e164, preserving existing "enabled"
  const { error } = await supabase
    .from('op_lines')
    .upsert(rows, { onConflict: 'phone_e164' });

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ ok: true, synced: rows.length });
}
