// api/openphone-webhook.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// tiny helper to read raw JSON body in Vercel functions
async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8") || "{}";
  try { return JSON.parse(raw); } catch { return {}; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 1) authenticate: header OR query param (?secret=...)
  const url = new URL(req.url, `https://${req.headers.host}`);
  const qSecret = url.searchParams.get("secret");
  const hSecret = req.headers["x-api-key"];
  const expected = process.env.OPENPHONE_WEBHOOK_SECRET;

  if (!expected || (qSecret !== expected && hSecret !== expected)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // 2) parse event
  const event = await readJson(req);
  const type = event?.type;
  const obj = event?.data?.object || {};

  // Pull out common fields
  const lineId = obj.phoneNumberId || null; // PN...
  const lineLookup = lineId
    ? await supabase.from("openphone_lines").select("*").eq("line_id", lineId).maybeSingle()
    : { data: null, error: null };

  const line = lineLookup.data || null;

  // If we know the line and it's NOT a customer line, ignore
  if (line && line.is_customer_line === false) {
    return res.status(200).json({ ok: true, skipped: "non-customer line" });
  }

  // Determine the customer phone (E.164) based on event type
  let customerPhone = null;
  let conversationUrl = null;

  if (type?.startsWith("message.")) {
    // message.received payload example has: from (customer), to (our line)
    customerPhone = obj.from || null;
    if (event?.data?.object?.conversationId) {
      conversationUrl = `https://my.openphone.com/inbox/${lineId}/c/${event.data.object.conversationId}`;
    }
  } else if (type?.startsWith("call.")) {
    // calls have participants = [numbers]; for inbound, the external number should be present
    if (Array.isArray(obj.participants) && obj.participants.length) {
      // pick the first participant that is NOT our line number (if we know it)
      const ourLineNumber = line?.line_number_e164 || null;
      customerPhone = obj.participants.find(p => p !== ourLineNumber) || obj.participants[0];
    }
    if (obj.conversationId) {
      conversationUrl = `https://my.openphone.com/inbox/${lineId}/c/${obj.conversationId}`;
    }
  }

  if (!customerPhone) {
    // nothing useful to do
    return res.status(200).json({ ok: true, skipped: "no customer phone" });
  }

  // 3) upsert a lead ONLY if it doesn't exist yet (prevent duplicates)
  // we use leads.phone_e164 as unique
  const { data: existing, error: findErr } = await supabase
    .from("leads")
    .select("id")
    .eq("phone_e164", customerPhone)
    .limit(1)
    .maybeSingle();

  if (findErr) {
    return res.status(500).json({ error: "DB read error", detail: findErr.message });
  }

  if (existing) {
    // already have this lead; do nothing (tier-1 requirement)
    return res.status(200).json({ ok: true, dedupe: true, lead_id: existing.id });
  }

  // prepare inbound line details from lookup (if any)
  const inboundName = line?.line_name || null;
  const inboundNum = line?.line_number_e164 || null;

  const insertRow = {
    phone_e164: customerPhone,
    first_contact_at: new Date().toISOString(),
    inbound_line_name: inboundName,
    inbound_line_number: inboundNum,
    openphone_conversation_url: conversationUrl
  };

  const { data: inserted, error: insErr } = await supabase
    .from("leads")
    .insert(insertRow)
    .select("id")
    .maybeSingle();

  if (insErr) {
    return res.status(500).json({ error: "DB insert error", detail: insErr.message });
  }

  return res.status(200).json({ ok: true, created: inserted?.id || true });
}
