import { useEffect, useState, type FormEvent } from 'react'
import { useUser } from '../lib/auth'
import { getQueue } from '../lib/offline'
import { supabase } from '../lib/supabase'
import { useOnline } from '../lib/hooks'
import { getInstallPrompt, onInstallPromptChange, promptInstall } from '../lib/install'

export default function Account() {
  const { userId, email, profile, setProfile, signOut } = useUser()
  const online = useOnline()
  const [name, setName] = useState(profile?.display_name ?? '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [canInstall, setCanInstall] = useState(() => !!getInstallPrompt())

  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)

  useEffect(() => onInstallPromptChange(() => setCanInstall(!!getInstallPrompt())), [])

  async function update(fields: { display_name?: string; unit?: string }) {
    setSaving(true)
    setMsg(null)
    const { data, error } = await supabase.from('profiles').update(fields).eq('id', userId).select().single()
    setSaving(false)
    if (error) return setMsg(online ? error.message : 'Connect to the internet to change this.')
    setProfile(data)
    setMsg('Saved')
  }

  function saveName(e: FormEvent) {
    e.preventDefault()
    const n = name.trim()
    if (n && n !== profile?.display_name) void update({ display_name: n })
  }

  const pending = getQueue(userId).length

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Account</h1>
        <p className="muted">{email}</p>
      </header>

      <form onSubmit={saveName} className="stack section">
        <label className="field">
          <span className="field-label">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} autoComplete="name" />
        </label>
      </form>

      <fieldset className="section field">
        <legend className="field-label">Weight unit</legend>
        <div className="segmented" role="radiogroup">
          {(['lb', 'kg'] as const).map((u) => (
            <button
              key={u}
              type="button"
              role="radio"
              aria-checked={profile?.unit === u}
              className={profile?.unit === u ? 'seg seg-on' : 'seg'}
              onClick={() => profile?.unit !== u && void update({ unit: u })}
              disabled={saving}
            >
              {u === 'lb' ? 'Pounds (lb)' : 'Kilograms (kg)'}
            </button>
          ))}
        </div>
        <p className="hint">This changes the label only. Numbers you've already logged aren't converted.</p>
      </fieldset>
      {msg && (
        <p className="note" role="status">
          {msg}
        </p>
      )}

      {!standalone && (
        <section className="section">
          <h2 className="section-title">Put it on your home screen</h2>
          {canInstall ? (
            <button className="btn btn-primary" onClick={() => void promptInstall()}>
              Install app
            </button>
          ) : isIOS ? (
            <p className="muted">In Safari, tap the Share button, then Add to Home Screen.</p>
          ) : (
            <p className="muted">Open your browser menu and choose Install app or Add to Home screen.</p>
          )}
          <p className="hint">Installed, it opens full screen and works with no signal.</p>
        </section>
      )}

      <section className="section">
        {pending > 0 && (
          <p className="hint">
            {pending} {pending === 1 ? 'set hasn’t' : 'sets haven’t'} uploaded yet. If you sign out now,{' '}
            {pending === 1 ? 'it uploads' : 'they upload'} the next time you sign in on this phone.
          </p>
        )}
        <button className="btn" onClick={() => void signOut()}>
          Sign out
        </button>
      </section>
    </div>
  )
}
