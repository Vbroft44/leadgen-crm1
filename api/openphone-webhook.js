// Tell Vercel to use Node.js 20
export const config = {
  runtime: "nodejs20.x"
};

import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client with service role key (for server-side use only!)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const secret = req.headers["x-openphone-secret"];
    if (secret !== process.env.OPENPHONE_WEBHOOK_SECRET) {
      return res.status(401).json({ error: "Invalid secret" });
    }

    const event = req.body;

    // Example: save call log into Supabase
    const { error } = await supabase.from("activities").insert([
      {
        type: event.type || "unknown",
        data: event,
        created_at: new Date().toISOString()
      }
    ]);

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
