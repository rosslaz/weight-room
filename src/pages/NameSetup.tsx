import { useState, type FormEvent } from 'react'
import { useUser } from '../lib/auth'
import { supabase } from '../lib/supabase'

export default function NameSetup() {
  const { userId, setProfile, signOut } = useUser()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(e: FormEvent) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return setError('Enter your name.')
    setBusy(true)
    const { data, error } = await supabase
      .from('profiles')
      .update({ display_name: n })
      .eq('id', userId)
      .select()
      .single()
    setBusy(false)
    if (error) return setError(error.message)
    setProfile(data)
  }

  return (
    <div className="signin">
      <div className="signin-board">
        <img className="signin-logo" src="/falcon.png" alt="" width={112} height={112} />
        <h1 className="signin-title">What's your name?</h1>
        <p className="signin-lede">Your coach sees this name. Your logged weights stay private to you.</p>
        <form onSubmit={save} className="stack">
          <label className="field">
            <span className="field-label">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus />
          </label>
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Saving…' : 'Continue'}
          </button>
          <button type="button" className="btn-link" onClick={() => void signOut()}>
            Sign out
          </button>
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
