// Force Node.js 20 for this single function
export const config = { runtime: "nodejs20.x" };

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Validate shared secret from OpenPhone
  const provided = req.headers["x-api-key"];
  if (!provided || provided !== process.env.OPENPHONE_WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const event = req.body || {};

    // store activity
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

    // best-effort link to a lead by last 7 digits
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
