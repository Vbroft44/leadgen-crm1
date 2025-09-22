import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const provided = req.headers["x-api-key"];
  if (!provided || provided !== process.env.OPENPHONE_WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const event = req.body || {};

    const { data: activity, error } = await supabase
      .from("activities")
      .insert({
        kind: event.type || event.event || "unknown",
        phone:
          event?.from?.phoneNumber ||
          event?.contact?.phone ||
          event?.caller_number ||
          null,
        payload: event
      })
      .select()
      .single();

    if (error) throw error;

    if (activity?.phone) {
      const last7 = String(activity.phone).slice(-7);
      const { data: lead } = await supabase
        .from("leads")
        .select("id")
        .like("phone", `%${last7}%`)
        .limit(1)
        .maybeSingle();

      if (lead?.id) {
        await supabase
          .from("activities")
          .update({ lead_id: lead.id })
          .eq("id", activity.id);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("webhook error:", e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
