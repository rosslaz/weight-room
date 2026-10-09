import { useState, type FormEvent } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { APP_NAME, supabase } from '../lib/supabase'
import { readLastEmail, saveLastEmail } from '../lib/lastEmail'

// Email-only sign-in: type your email and you're in. No password, no code.
export default function SignIn() {
  const [email, setEmail] = useState(readLastEmail)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn(e: FormEvent) {
    e.preventDefault()
    const addr = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(addr)) {
      setError('Enter your full email address.')
      return
    }
    if (!navigator.onLine) {
      setError("You're offline. Connect to sign in.")
      return
    }
    setBusy(true)
    setError(null)
    const { data, error: fnError } = await supabase.functions.invoke<{ token_hash?: string; error?: string }>(
      'email-login',
      { body: { email: addr } },
    )
    if (fnError || !data?.token_hash) {
      let message = data?.error
      if (fnError instanceof FunctionsHttpError) {
        try {
          message = (await fnError.context.json())?.error
        } catch {
          /* body wasn't JSON */
        }
      }
      setBusy(false)
      setError(message || "Couldn't sign in. Check your connection and try again.")
      return
    }
    const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' })
    setBusy(false)
    if (verifyError) {
      setError("Couldn't sign in. Try again.")
      return
    }
    saveLastEmail(addr)
    // The auth listener swaps this screen out.
  }

  return (
    <div className="signin">
      <div className="signin-board">
        <img className="signin-logo" src="/falcon.png" alt="" width={112} height={112} />
        <h1 className="signin-title">{APP_NAME}</h1>
        <p className="signin-lede">See the day's workout and log your weights. Last time's numbers are waiting for you.</p>

        <form onSubmit={signIn} className="stack" noValidate>
          <label className="field">
            <span className="field-label">Email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="hint">Use the same email every time so your history follows you.</p>
        </form>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
