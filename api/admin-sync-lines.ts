// /api/admin-sync-lines.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function authed(req: VercelRequest) {
  const c = req.headers.cookie || '';
  return c.split(';').some(p => p.trim().startsWith('admin_auth=1'));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!authed(req)) return res.status(401).json({ error: 'unauthorized' });

  const { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENPHONE_API_KEY } = process.env;
  if (!VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Missing Supabase env (VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)' });
  }
  if (!OPENPHONE_API_KEY) {
    return res.status(500).json({ error: 'Missing OPENPHONE_API_KEY' });
  }

  const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // IMPORTANT: OpenPhone expects the API key as plain Authorization header (no "Bearer")
  const r = await fetch('https://api.openphone.com/v1/phone-numbers', {
    headers: {
      Authorization: OPENPHONE_API_KEY as string,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  });

  const raw = await r.text();
  if (!r.ok) {
    return res.status(r.status).json({ error: 'OpenPhone API error', body: raw });
  }

  let json: any;
  try { json = JSON.parse(raw); } catch { json = raw; }

  // Normalize common shapes from the API
  const items: any[] = Array.isArray(json) ? json : (json?.data ?? json?.items ?? []);
  if (!Array.isArray(items)) {
    return res.status(500).json({ error: 'Unexpected OpenPhone response format', preview: String(raw).slice(0, 300) });
  }

  const nowIso = new Date().toISOString();

  // Map into our op_lines table schema (do NOT include is_enabled_for_crm so we don't overwrite your toggles)
  const incoming = items
    .map((n: any) => ({
      op_line_id: n.id ?? n.phoneNumberId ?? n.numberId ?? n.e164 ?? n.phoneNumber ?? null,
      phone_e164: n.e164 ?? n.phoneNumber ?? n.number ?? null,
      display_name: n.name ?? n.label ?? n.friendlyName ?? n.display_name ?? '',
      status: (n.status ?? 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active',
      last_seen_at: nowIso,
    }))
    .filter((x: any) => x.op_line_id && x.phone_e164);

  if (incoming.length) {
    const { error: upErr } = await supabase
      .from('op_lines')
      .upsert(incoming, { onConflict: 'op_line_id' });
    if (upErr) return res.status(500).json({ error: upErr.message });
  }

  // Mark lines we no longer see as inactive (don’t touch is_enabled_for_crm)
  const { data: existing, error: exErr } = await supabase
    .from('op_lines')
    .select('op_line_id');
  if (exErr) return res.status(500).json({ error: exErr.message });

  const incomingIds = new Set(incoming.map(x => x.op_line_id));
  const toInactive = (existing || [])
    .map((x: any) => x.op_line_id)
    .filter((id: string) => !incomingIds.has(id));

  if (toInactive.length) {
    const { error: inErr } = await supabase
      .from('op_lines')
      .update({ status: 'inactive', last_seen_at: nowIso })
      .in('op_line_id', toInactive);
    if (inErr) return res.status(500).json({ error: inErr.message });
  }

  return res.status(200).json({ ok: true, addedOrUpdated: incoming.length, inactivated: toInactive.length });
}
