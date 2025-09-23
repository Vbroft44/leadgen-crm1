// api/openphone-webhook.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Read raw JSON body (Vercel Node runtime)
async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8") || "{}";
  try { return JSON.parse(raw); } catch { return {}; }
}

const norm = (v) => (v || "").toString().replace(/[^0-9+]/g, "");

// extract a phone number from many possible shapes
function extractNumber(val) {
  if (!val) return null;
  if (typeof val === "string") return norm(val);
  if (Array.isArray(val)) {
    for (const item of val) {
      const got = extractNumber(item);
      if (got) return got;
    }
    return null;
  }
  if (typeof val === "object") {
    // common keys we might see
    const cand =
      val.phoneNumber ??
      val.number ??
      val.e164 ??
      val.value ??
      val.id ?? // sometimes id is a phone number
      null;
    return cand ? norm(cand) : null;
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Auth with query (?secret=...) because OpenPhone UI doesn't support headers
  const url = new URL(req.url, `https://${req.headers.host}`);
  const qSecret = url.searchParams.get("secret");
  const expected = process.env.OPENPHONE_WEBHOOK_SECRET;
  if (!expected || qSecret !== expected) {
    console.log("Unauthorized webhook");
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Parse event
  const ev = await readJson(req);
  const type = ev?.type || ev?.event || "";
  const obj = ev?.data?.object || ev?.object || ev || {};
  const direction = obj.direction || ev.direction || null; // "incoming"/"outgoing"
  const phoneNumberId = obj.phoneNumberId || obj.lineId || ev.phoneNumberId || null; // PN...
  const convId = obj.conversationId || obj.threadId || null;

  // Possible fields
  const from = obj.from ?? null;
  const to = obj.to ?? null;
  const participants = Array.isArray(obj.participants) ? obj.participants : [];

  // Resolve our line (allow-list)
  let line = null;
  if (phoneNumberId) {
    const { data, error } = await supabase
      .from("openphone_lines")
      .select("*")
      .eq("line_id", phoneNumberId)
      .maybeSingle();
    if (error) console.error("line lookup by id error:", error);
    line = data || null;
  }
  if (!line) {
    const ourNumCandidate = extractNumber(to);
    if (ourNumCandidate) {
      const { data, error } = await supabase
        .from("openphone_lines")
        .select("*")
        .eq("line_number_e164", ourNumCandidate)
        .maybeSingle();
      if (error) console.error("line lookup by number error:", error);
      line = data || null;
    }
  }

  if (line && line.is_customer_line === false) {
    console.log("Skip: non-customer line", { line_id: line.line_id });
    return res.status(200).json({ ok: true, skipped: "non-customer line" });
  }

  // Determine inbound customer phone
  let customerPhone = null;
  const ourLineNumber = line?.line_number_e164 || extractNumber(to) || null;

  if (type.startsWith("message.")) {
    if (direction && direction !== "incoming") {
      console.log("Skip: outbound message");
      return res.status(200).json({ ok: true, skipped: "outbound message" });
    }
    customerPhone = extractNumber(from);
  } else if (type.startsWith("call.")) {
    if (direction && direction !== "incoming") {
      console.log("Skip: outbound call");
      return res.status(200).json({ ok: true, skipped: "outbound call" });
    }
    // Try participants first, then from
    const theirFrom = extractNumber(from);
    if (participants.length) {
      const normOur = norm(ourLineNumber);
      const other = participants
        .map(extractNumber)
        .find((p) => p && (!normOur || p !== normOur));
      customerPhone = other || theirFrom;
    } else {
      customerPhone = theirFrom;
    }
  } else {
    console.log("Skip: unknown event type", { type });
    return res.status(200).json({ ok: true, skipped: "unknown type" });
  }

  if (!customerPhone) {
    console.log("Skip: no customer phone resolved", { type, direction, from, to, participants });
    return res.status(200).json({ ok: true, skipped: "no customer phone" });
  }

  try {
    // Dedup by phone
    const { data: existing, error: findErr } = await supabase
      .from("leads")
      .select("id")
      .eq("phone_e164", customerPhone)
      .maybeSingle();

    if (findErr) throw new Error(`DB read error: ${findErr.message}`);

    if (existing) {
      console.log("Dedup: lead exists", { id: existing.id, phone: customerPhone });
      return res.status(200).json({ ok: true, dedupe: true, lead_id: existing.id });
    }

    let conversationUrl = null;
    const resolvedLineId = line?.line_id || phoneNumberId || null;
    if (convId && resolvedLineId) {
      conversationUrl = `https://my.openphone.com/inbox/${resolvedLineId}/c/${convId}`;
    }

    const row = {
      phone_e164: customerPhone,
      first_contact_at: new Date().toISOString(),
      inbound_line_id: resolvedLineId,
      inbound_line_name: line?.line_name || null,
      inbound_line_number: ourLineNumber,
      openphone_conversation_id: convId || null,
      openphone_conversation_url: conversationUrl
    };

    const { data: inserted, error: insErr } = await supabase
      .from("leads")
      .insert(row)
      .select("id")
      .maybeSingle();

    if (insErr) throw new Error(`DB insert error: ${insErr.message}`);

    console.log("Created lead", { id: inserted?.id, phone: customerPhone });
    return res.status(200).json({ ok: true, created: inserted?.id || true });
  } catch (e) {
    console.error("Webhook failure:", e?.message || e);
    return res.status(500).json({ error: "internal", detail: e?.message || String(e) });
  }
}
