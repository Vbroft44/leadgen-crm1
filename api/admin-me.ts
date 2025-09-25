import type { VercelRequest, VercelResponse } from '@vercel/node';

function hasAdminCookie(req: VercelRequest) {
  const c = req.headers.cookie || '';
  return c.split(';').some(part => part.trim().startsWith('admin_auth=1'));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!hasAdminCookie(req)) return res.status(401).json({ ok: false });
  return res.status(200).json({ ok: true });
}
