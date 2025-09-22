// ESM version for Vercel Node.js 20
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    const secret = process.env.OPENPHONE_WEBHOOK_SECRET;
    const provided = req.headers['x-api-key'] || req.query['api_key'];
    if (!secret || provided !== secret) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );

    const event = req.body || {};
    const phone =
      event?.from?.phoneNumber ||
      event?.contact?.phone ||
      event?.caller_number ||
      null;

    // Insert activity
    const { data: activity, error: aerr } = await supabase
      .from('activities')
      .insert({
        kind: event.type || event.event || 'unknown',
        phone,
        payload: event
      })
      .select()
      .single();

    if (aerr) throw aerr;

    // Best-effort link to a lead by last 7 digits
    if (phone) {
      const last7 = phone.slice(-7);
      const { data: lead } = await supabase
        .from('leads')
        .select('id')
        .like('phone', `%${last7}%`)
        .limit(1)
        .maybeSingle();

      if (lead?.id) {
        await supabase.from('activities').update({ lead_id: lead.id }).eq('id', activity.id);
        await supabase.from('leads').update({ updated_at: new Date().toISOString() }).eq('id', lead.id);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
