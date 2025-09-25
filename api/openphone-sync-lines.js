// /api/openphone-sync-lines.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Allow GET or POST
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const { OPENPHONE_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

    if (!OPENPHONE_API_KEY) {
      return res.status(500).json({ ok: false, error: 'Missing OPENPHONE_API_KEY' });
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ ok: false, error: 'Missing Supabase env (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ---- OpenPhone: fetch numbers (NOTE: no "Bearer", no "x-api-key") ----
    const resp = await fetch('https://api.openphone.com/v1/phone-numbers', {
      headers: {
        Authorization: OPENPHONE_API_KEY as string,
        'Content-Type': 'application/json',
      },
    });

    const raw = await resp.text();
    if (!resp.ok) {
      return res.status(resp.status).json({
        ok: false,
        error: 'OpenPhone API error',
        body: raw,
      });
    }

    let json: any;
    try {
      json = JSON.parse(raw);
    } catch {
      json = raw;
    }

    // Normalize possible shapes
    const list = Array.isArray(json) ? json : json?.data ?? json?.items ?? [];
    if (!Array.isArray(list)) {
      return res.status(500).json({ ok: false, error: 'Unexpected OpenPhone response shape' });
    }

    // Shape rows for DB: keep flexible mapping for number/name
    const numbers = list
      .map((n: any) => {
        const phone_e164 =
          n?.e164 ?? n?.phoneNumber ?? n?.number ?? n?.phone_number ?? null;

        const display_name =
          n?.display_name ?? n?.label ?? n?.name ?? n?.title ?? '';

        const line_id = n?.id ?? phone_e164 ?? null;

        return { line_id, phone_e164, display_name };
      })
      .filter((r: any) => r.line_id && r.phone_e164);

    // Pull existing flags so we don't overwrite your is_customer choices
    const { data: existing, error: selErr } = await supabase
      .from('openphone_lines')
      .select('line_id,is_customer');

    if (selErr) return res.status(500).json({ ok: false, error: selErr.message });

    const flagMap = new Map<string, boolean>();
    (existing ?? []).forEach((r: any) => flagMap.set(r.line_id, r.is_customer));

    const upsertRows = numbers.map((r: any) => ({
      ...r,
      is_customer: flagMap.has(r.line_id) ? flagMap.get(r.line_id) : true, // default true for new rows
      updated_at: new Date().toISOString(),
    }));

    const { data: upserted, error: upErr } = await supabase
      .from('openphone_lines')
      .upsert(upsertRows, { onConflict: 'line_id' })
      .select();

    if (upErr) return res.status(500).json({ ok: false, error: upErr.message });

    return res.status(200).json({
      ok: true,
      count: upserted?.length ?? 0,
      preview: (upserted ?? []).slice(0, 3),
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
}
