import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const pass = process.env.ADMIN_PASS;
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'Missing password' });

  if (password !== pass) return res.status(401).json({ ok: false });

  // 7 days
  res.setHeader('Set-Cookie', `admin_auth=1; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=604800`);
  return res.status(200).json({ ok: true });
}
