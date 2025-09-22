
// Vercel serverless function.
// Requires env: SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL, OPENPHONE_WEBHOOK_SECRET
const { createClient } = require('@supabase/supabase-js')

module.exports = async (req, res) => {
  const secret = process.env.OPENPHONE_WEBHOOK_SECRET
  const provided = req.headers['x-api-key'] || req.query['api_key']
  if (!secret || provided !== secret) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }

  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  })

  try {
    const event = req.body || {}
    // Best-effort phone extraction
    const phone = event?.from?.phoneNumber || event?.contact?.phone || event?.caller_number || null

    // Upsert activity
    const { data: activity, error: aerr } = await supabase.from('activities').insert({
      kind: event.type || event.event || 'unknown',
      phone: phone,
      payload: event
    }).select().single()
    if (aerr) throw aerr

    // If we can find a lead by phone, link it
    if (phone) {
      const { data: lead } = await supabase.from('leads').select('id').like('phone', `%${phone.slice(-7)}%`).limit(1).maybeSingle()
      if (lead?.id) {
        await supabase.from('activities').update({ lead_id: lead.id }).eq('id', activity.id)
        await supabase.from('leads').update({ updated_at: new Date().toISOString() }).eq('id', lead.id)
      }
    }

    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message })
  }
}
