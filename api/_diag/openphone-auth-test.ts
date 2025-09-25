// /api/_diag/openphone-auth-test.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiKey = process.env.OPENPHONE_API_KEY;
  if (!apiKey) return res.status(500).json({ ok: false, error: 'Missing OPENPHONE_API_KEY' });

  const r = await fetch('https://api.openphone.com/v1/phone-numbers', {
    headers: { Authorization: apiKey }, // IMPORTANT: no "Bearer", no "x-api-key"
  });

  const text = await r.text();
  return res.status(r.status).json({
    ok: r.ok,
    status: r.status,
    statusText: r.statusText,
    preview: text.slice(0, 200),
  });
}
