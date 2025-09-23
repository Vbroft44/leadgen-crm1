import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const norm = (v) => (v || "").toString().replace(/[^0-9+]/g, "").toLowerCase();

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // secure the webhook
  const provided = req.headers["x-api-key"];
  if (!provided || provided !== process.env.OPENPHONE_WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const ev = typeof req.body === "string" ? safeJson(req.body) : (req.body || {});
  const obj = ev?.data?.object || {};
  const type = ev?.type || ev?.event || "";
  const direction = obj?.direction || ev?.direction;      // "incoming"/"outgoing"
  const phoneNumberId = obj?.phoneNumberId || ev?.phoneNumberId || null;

  const isInboundMessage = type === "message.received" || direction === "incoming";
  const isCall = type?.startsWith?.("call.");
  const isInboundCall = isCall && direction === "incoming";

  // only act on first inbound
  if (!isInboundMessage && !isInboundCall) {
    return res.status(200).json({ ok: true, ignored: true });
  }

  // external (customer) number is "from" on inbound
  const from = norm(obj?.from || ev?.from);
  const toArr = obj?.to || ev?.to || [];
  const to = norm(Array.isArray(toArr) ? toArr[0] : toArr);
  const customer = from || null;
  const lineId = phoneNumberId || null;

  if (!customer || !lineId) {
    return res.status(400).json({ error: "Missing customer or line id" });
  }

  // allow-list check (tech lines will be false)
  const { data: lineRow } = await supabase
    .from("openphone_lines")
    .select("line_id, line_name, line_number_e164, is_customer_line")
    .eq("line_id", lineId)
    .maybeSingle();

  if (!lineRow) {
    // unseen line → add (default true) so you can flip later if needed
    await supabase.from("openphone_lines").insert({
      line_id: lineId,
      line_number_e164: to || null,
      line_name: null,
      is_customer_line: true
    });
  } else if (lineRow.is_customer_line === false) {
    return res.status(200).json({ ok: true, ignored: "tech line" });
  }

  // first contact timestamp (only set once)
  const firstAt = obj?.createdAt || ev?.createdAt || new Date().toISOString();

  // conversation id/url if present in the event
  const conversationId = obj?.conversationId || ev?.conversationId || null;
  const convUrl =
    conversationId && lineId
      ? `https://my.openphone.com/inbox/${lineId}/c/${conversationId}`
      : null;

  // insert lead; unique index on phone_e164 prevents duplicates
  const { error: insertErr } = await supabase.from("leads").insert({
    phone: customer,
    phone_e164: customer,
    first_contact_at: firstAt,
    inbound_line_id: lineId,
    inbound_line_name: lineRow?.line_name || null,
    inbound_line_number: lineRow?.line_number_e164 || to || null,
    openphone_conversation_id: conversationId,
    openphone_conversation_url: convUrl,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  if (insertErr && insertErr.code !== "23505") {
    // 23505 = unique violation (lead already exists) → OK
    return res.status(500).json({ error: insertErr.message });
  }

  return res.status(200).json({ ok: true, created: !insertErr });
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
