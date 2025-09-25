// /api/openphone-auth-test.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const key = process.env.OPENPHONE_API_KEY;
  if (!key) return res.status(500).json({ ok: false, error: 'Missing OPENPHONE_API_KEY' });

  const resp = await fetch('https://api.openphone.com/v1/phone-numbers', {
    headers: { Authorization: key }, // no "Bearer", no "x-api-key"
  });

  const text = await resp.text();
  return res.status(resp.status).json({
    ok: resp.ok,
    status: resp.status,
    statusText: resp.statusText,
    preview: text.slice(0, 200),
  });
}
