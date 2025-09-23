import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const resp = await fetch("https://api.openphone.com/v1/phone-numbers", {
      headers: { Authorization: `Bearer ${process.env.OPENPHONE_API_KEY}` }
    });
    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ error: "OpenPhone API error", detail: text });
    }
    const json = await resp.json();

    const rows = (json.data || []).map((n) => ({
      line_id: n.id,
      line_number_e164: n.number || null,
      line_name: n.name || null,
      is_customer_line: true
    }));

    if (!rows.length) return res.status(200).json({ ok: true, imported: 0 });

    const { error } = await supabase.from("openphone_lines").upsert(rows, { onConflict: "line_id" });
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ ok: true, imported: rows.length });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
