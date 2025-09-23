// api/openphone-sync-lines.js
// One-time (or occasional) importer: pulls all OpenPhone numbers and upserts into `openphone_lines`

import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client (service role)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.OPENPHONE_API_KEY) {
    return res.status(500).json({ error: "Missing OPENPHONE_API_KEY env var" });
  }

  try {
    // IMPORTANT: OpenPhone expects the raw API key, NOT "Bearer <key>"
    const resp = await fetch("https://api.openphone.com/v1/phone-numbers", {
      headers: { Authorization: process.env.OPENPHONE_API_KEY }
    });

    if (!resp.ok) {
      const text = await resp.text();
      return res
        .status(resp.status)
        .json({ error: "OpenPhone API error", detail: text });
    }

    const json = await resp.json();
    const numbers = Array.isArray(json?.data) ? json.data : [];

    const rows = numbers.map((n) => ({
      line_id: n.id,                        // PN...
      line_number_e164: n.number || null,   // +1...
      line_name: n.name || null,            // your label for the line
      is_customer_line: true                // default allow; flip tech lines to false in Supabase
    }));

    if (rows.length === 0) {
      return res.status(200).json({ ok: true, imported: 0 });
    }

    const { error } = await supabase
      .from("openphone_lines")
      .upsert(rows, { onConflict: "line_id" });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ ok: true, imported: rows.length });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
