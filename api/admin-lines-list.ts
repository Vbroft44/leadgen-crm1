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

  const { data, error } = await supabase
    .from('op_lines')
    .select('op_line_id, phone_e164, display_name, status, is_enabled_for_crm, last_seen_at')
    .order('status', { ascending: false })
    .order('display_name', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ lines: data || [] });
}
