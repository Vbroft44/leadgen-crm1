import type { VercelRequest, VercelResponse } from '@vercel/node';

const BASE = 'https://api.openphone.com/v1';

async function tryHeader(url: string, headers: Record<string, string>) {
  const r = await fetch(url, { method: 'GET', headers });
  const text = await r.text();
  return { ok: r.ok, status: r.status, statusText: r.statusText, body: text.slice(0, 500) };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = process.env.OPENPHONE_API_KEY;
  if (!token) return res.status(500).json({ error: 'Missing OPENPHONE_API_KEY' });

  const url = `${BASE}/phone-numbers`; // harmless list endpoint

  // 1) Try Authorization: Bearer
  const bearer = await tryHeader(url, {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
  });

  if (bearer.ok) {
    return res.status(200).json({ success: true, style: 'Authorization: Bearer', result: bearer });
  }

  // 2) Try x-api-key
  const xapikey = await tryHeader(url, {
    'x-api-key': token,
    'Accept': 'application/json',
  });

  if (xapikey.ok) {
    return res.status(200).json({ success: true, style: 'x-api-key', result: xapikey });
  }

  return res.status(401).json({
    success: false,
    message: 'Both header styles failed. Token may be wrong type (webhook secret vs API token), revoked, or for a different workspace.',
    bearer, xapikey,
  });
}
