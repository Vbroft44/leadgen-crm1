import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  // expire the cookie immediately
  res.setHeader('Set-Cookie', `admin_auth=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`);
  return res.status(200).json({ ok: true });
}
