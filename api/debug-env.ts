import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Never return the secret itself, only presence + a tiny masked preview
  const token = process.env.OPENPHONE_API_KEY || '';
  const present = Boolean(token);
  const masked = token ? `${token.slice(0, 5)}…(len:${token.length})` : '';

  res.status(200).json({
    OPENPHONE_API_KEY: { present, maskedPreview: masked },
    env: process.env.VERCEL_ENV || 'unknown',
  });
}
