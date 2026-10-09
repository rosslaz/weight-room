import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useUser } from '../../lib/auth'
import type { Profile } from '../../lib/data'
import { formatMonthDay, toISODate } from '../../lib/dates'

export default function People() {
  const { userId } = useUser()
  const [rows, setRows] = useState<Profile[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('display_name', { nullsFirst: false })
    if (error) return setError(error.message)
    setRows(data)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function setAdmin(id: string, isAdmin: boolean) {
    const { error } = await supabase.rpc('set_admin', { p_user_id: id, p_is_admin: isAdmin })
    if (error) return setError(error.message)
    void load()
  }

  return (
    <>
      <p className="muted">
        Everyone who has signed in. Admins can build workouts and manage exercises. To add someone, send them the app
        link; they sign in with their email.
      </p>
      {error && <p className="error">{error}</p>}
      {rows === null && !error && <div className="loading-lines" aria-busy="true" />}
      {rows && (
        <ul className="list">
          {rows.map((p) => (
            <li key={p.id} className="list-row">
              <span className="list-main">
                <span className="list-title">
                  {p.display_name || 'No name yet'}
                  {p.is_admin && <span className="tag">Admin</span>}
                </span>
                <span className="list-sub">
                  {p.email}, joined {formatMonthDay(toISODate(new Date(p.created_at)))}
                </span>
              </span>
              {p.id === userId ? (
                <span className="list-meta">You</span>
              ) : (
                <button className="btn btn-small" onClick={() => void setAdmin(p.id, !p.is_admin)}>
                  {p.is_admin ? 'Remove admin' : 'Make admin'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
