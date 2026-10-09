import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '../lib/auth'
import { formatWeight } from '../lib/data'
import { formatMonthDay } from '../lib/dates'
import { readJSON, writeJSON } from '../lib/offline'
import { supabase } from '../lib/supabase'

type Summary = {
  exercise_id: string
  name: string
  sessions: number
  last_date: string
  best_weight: number | null
  last_top_weight: number | null
}

export default function History() {
  const { userId, profile } = useUser()
  const unit = profile?.unit ?? 'lb'
  const cacheKey = `wr:${userId}:summary`
  const [rows, setRows] = useState<Summary[] | null>(() => readJSON<Summary[] | null>(cacheKey, null))
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    let alive = true
    supabase.rpc('my_exercise_summary').then(({ data, error }) => {
      if (!alive) return
      if (error) {
        if (!readJSON(cacheKey, null)) setError("You're offline and your history hasn't been saved on this phone yet.")
        return
      }
      setRows(data ?? [])
      writeJSON(cacheKey, data ?? [])
    })
    return () => {
      alive = false
    }
  }, [cacheKey])

  const shown = (rows ?? []).filter((r) => r.name.toLowerCase().includes(filter.trim().toLowerCase()))

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">History</h1>
        <p className="muted">Your heaviest set from each session, by exercise.</p>
      </header>

      {error && <p className="banner">{error}</p>}
      {rows === null && !error && <div className="loading-lines" aria-busy="true" aria-label="Loading history" />}

      {rows && rows.length === 0 && (
        <div className="empty">
          <p className="empty-title">Nothing logged yet.</p>
          <p className="muted">Log a set in today's workout and it shows up here.</p>
          <Link to="/" className="btn">
            Go to today's workout
          </Link>
        </div>
      )}

      {rows && rows.length > 6 && (
        <label className="field search">
          <span className="sr-only">Find an exercise</span>
          <input type="search" placeholder="Find an exercise" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </label>
      )}

      {shown.length > 0 && (
        <ul className="list">
          {shown.map((r) => (
            <li key={r.exercise_id}>
              <Link to={`/history/${r.exercise_id}`} className="list-row">
                <span className="list-main">
                  <span className="list-title">{r.name}</span>
                  <span className="list-sub">
                    Last {formatMonthDay(r.last_date)}, {r.sessions} {r.sessions === 1 ? 'session' : 'sessions'}
                  </span>
                </span>
                <span className="list-figure">
                  <span className="figure">{formatWeight(r.last_top_weight)}</span>
                  <span className="figure-unit">{unit}</span>
                  {r.best_weight !== null && r.best_weight !== r.last_top_weight && (
                    <span className="figure-sub">Best {formatWeight(r.best_weight)}</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
