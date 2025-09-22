
import { useEffect, useState } from 'react'
import { supabase } from './lib.supabase'

export default function AuthGate({ children }: { children: JSX.Element }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (loading) return <div className="p-8">Loading…</div>
  if (!session) return <AuthScreen />
  return children
}

function AuthScreen() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMagic = async () => {
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
    if (!error) setSent(true)
    else setError(error.message)
  }

  return (
    <div className="h-screen flex items-center justify-center">
      <div className="bg-white p-6 rounded-xl shadow w-full max-w-sm">
        <h1 className="text-xl font-bold mb-2">Sign in</h1>
        <p className="text-sm text-gray-500 mb-4">Enter your email and we’ll send you a magic link.</p>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"
          className="w-full border rounded px-3 py-2 mb-3" />
        <button onClick={sendMagic} className="w-full bg-blue-600 text-white rounded px-3 py-2">Send magic link</button>
        {sent && <p className="text-green-600 text-sm mt-2">Check your email.</p>}
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>
    </div>
  )
}
