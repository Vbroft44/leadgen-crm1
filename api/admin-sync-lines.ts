import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function authed(req: VercelRequest) {
  const c = req.headers.cookie || '';
  return c.split(';').some(p => p.trim().startsWith('admin_auth=1'));
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!authed(req)) return res.status(401).json({ error: 'unauthorized' });

  const key = process.env.OPENPHONE_API_KEY;
  if (!key) return res.status(500).json({ error: 'Missing OPENPHONE_API_KEY' });

  // --- Fetch numbers from OpenPhone ---
  const r = await fetch('https://api.openphone.com/v1/phone-numbers', {
    headers: { Authorization: `Bearer ${key}` }
  });

  if (!r.ok) {
    const t = await r.text();
    return res.status(502).json({ error: 'OpenPhone API error', body: t });
  }

  const json = await r.json();
  const raw = (json?.data || json?.phone_numbers || json || []) as any[];

  // Normalize fields we need
  const nowIso = new Date().toISOString();
  const incoming = raw.map((n: any) => ({
    op_line_id: n.id || n.phoneNumberId || n.numberId,
    phone_e164: n.phoneNumber || n.e164 || n.number,
    display_name: n.name || n.label || n.friendlyName || '',
    status: (n.status || 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active',
    last_seen_at: nowIso
  })).filter(x => !!x.op_line_id);

  // --- Upsert (do NOT include is_enabled_for_crm so we don't overwrite it) ---
  if (incoming.length) {
    const { error: upErr } = await supabase
      .from('op_lines')
      .upsert(incoming, { onConflict: 'op_line_id' });
    if (upErr) return res.status(500).json({ error: upErr.message });
  }

  // --- Mark missing ones as inactive (don’t delete, don’t touch enabled toggle) ---
  const { data: existing, error: exErr } = await supabase
    .from('op_lines')
    .select('op_line_id');

  if (exErr) return res.status(500).json({ error: exErr.message });

  const incomingSet = new Set(incoming.map(x => x.op_line_id));
  const toInactive = (existing || [])
    .map(x => x.op_line_id)
    .filter((id: string) => !incomingSet.has(id));

  if (toInactive.length) {
    const { error: inErr } = await supabase
      .from('op_lines')
      .update({ status: 'inactive', last_seen_at: nowIso })
      .in('op_line_id', toInactive);
    if (inErr) return res.status(500).json({ error: inErr.message });
  }

  return res.status(200).json({ ok: true, addedOrUpdated: incoming.length, inactivated: toInactive.length });
}
