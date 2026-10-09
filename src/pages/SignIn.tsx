import { useState, type FormEvent } from 'react'
import { APP_NAME, supabase } from '../lib/supabase'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function sendCode(e?: FormEvent) {
    e?.preventDefault()
    const addr = email.trim().toLowerCase()
    if (!addr.includes('@')) {
      setError('Enter the email address you use for the team.')
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: addr,
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) {
      setError(friendlyAuthError(error.message))
      return
    }
    setEmail(addr)
    setStep('code')
    setNotice(`We emailed a sign-in code to ${addr}. It can take a minute to arrive; check spam too.`)
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    const token = code.replace(/\D/g, '')
    if (token.length < 6) {
      setError('Enter the full code from the email.')
      return
    }
    setBusy(true)
    setError(null)
    let { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    if (error) {
      // First-time accounts get a sign-up code; try that type before giving up.
      const retry = await supabase.auth.verifyOtp({ email, token, type: 'signup' })
      if (!retry.error) error = null
    }
    setBusy(false)
    if (error) setError(friendlyAuthError(error.message))
    // On success the auth listener swaps this screen out.
  }

  return (
    <div className="signin">
      <div className="signin-board">
        <h1 className="signin-title">{APP_NAME}</h1>
        <p className="signin-lede">See the day's workout and log your weights. Last time's numbers are waiting for you.</p>

        {step === 'email' ? (
          <form onSubmit={sendCode} className="stack">
            <label className="field">
              <span className="field-label">Email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Sending…' : 'Email me a code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="stack">
            {notice && <p className="note">{notice}</p>}
            <label className="field">
              <span className="field-label">Code</span>
              <input
                className="code-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={10}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                autoFocus
              />
            </label>
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>
            <div className="row-between">
              <button type="button" className="btn-link" onClick={() => void sendCode()} disabled={busy}>
                Send a new code
              </button>
              <button
                type="button"
                className="btn-link"
                onClick={() => {
                  setStep('email')
                  setCode('')
                  setError(null)
                }}
              >
                Use a different email
              </button>
            </div>
          </form>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

function friendlyAuthError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('rate limit') || m.includes('security purposes') || m.includes('seconds'))
    return 'Too many codes requested. Wait a minute, then try again.'
  if (m.includes('expired') || m.includes('invalid')) return "That code didn't work. Check it, or send a new one."
  if (m.includes('not authorized') || m.includes('email address not authorized'))
    return "Sign-in emails can't be sent to this address yet. Ask your coach to finish the email setup."
  if (m.includes('fetch') || m.includes('network')) return "You're offline. Connect to sign in."
  return msg
}
