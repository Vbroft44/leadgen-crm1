
# LeadGen CRM — Full Pack (Auth + DB + OpenPhone)

## You get
- Login (magic link via Supabase Auth)
- Persistent leads in Postgres
- Technicians & assignments
- Activities table (stores call/SMS/webhook events)
- OpenPhone webhook endpoint (`/api/openphone-webhook`) for Vercel

## Setup
1. **Create Supabase project** → copy URL + anon key, service role key.
2. **SQL** → open Supabase SQL Editor, paste `schema.sql`, run.
3. **Env vars**
   - `.env` (local): set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - **Vercel** project settings:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
     - `OPENPHONE_WEBHOOK_SECRET` (any long random string)
4. **Run local**
   ```bash
   npm install
   npm run dev
   ```
5. **Deploy**: push to GitHub → import in Vercel

## OpenPhone
- Webhook URL: `https://YOUR-VERCEL-DOMAIN/api/openphone-webhook`
- Header: `x-api-key: YOUR_SECRET`
- The function stores events in `activities` and tries to link to a lead by matching the last 7 digits of phone numbers.

## Where to edit
- `src/leadgen-crm-dashboard.tsx` → your UI (now calls Supabase)
- `src/data.ts` → DB functions
- `api/openphone-webhook.js` → serverless webhook handler
