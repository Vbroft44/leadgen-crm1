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
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  if (!authed(req)) return res.status(401).json({ error: 'unauthorized' });

  const { op_line_id, enabled } = req.body || {};
  if (!op_line_id || typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'op_line_id and enabled are required' });
  }

  const { error } = await supabase
    .from('op_lines')
    .update({ is_enabled_for_crm: enabled })
    .eq('op_line_id', op_line_id);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
