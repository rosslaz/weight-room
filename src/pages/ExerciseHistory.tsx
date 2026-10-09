import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useUser } from '../lib/auth'
import { formatWeight } from '../lib/data'
import { formatShort, todayISO } from '../lib/dates'
import { readJSON, writeJSON } from '../lib/offline'
import { supabase } from '../lib/supabase'
import { IconChevronLeft } from '../components/Icons'

type Log = { workout_date: string; set_number: number; weight: number | null; reps: number | null }
type Cached = { name: string; logs: Log[] }
type Session = { date: string; sets: Log[]; top: number | null }

export default function ExerciseHistory() {
  const { exerciseId = '' } = useParams()
  const navigate = useNavigate()
  const { userId, profile } = useUser()
  const unit = profile?.unit ?? 'lb'
  const cacheKey = `wr:${userId}:exhist:${exerciseId}`
  const [data, setData] = useState<Cached | null>(() => readJSON<Cached | null>(cacheKey, null))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([
      supabase.from('exercises').select('name').eq('id', exerciseId).maybeSingle(),
      supabase
        .from('set_logs')
        .select('workout_date, set_number, weight, reps')
        .eq('user_id', userId)
        .eq('exercise_id', exerciseId)
        .order('workout_date', { ascending: false })
        .order('set_number')
        .limit(1000),
    ]).then(([ex, logs]) => {
      if (!alive) return
      if (ex.error || logs.error) {
        if (!readJSON(cacheKey, null)) setError("You're offline and this history hasn't been saved on this phone yet.")
        return
      }
      const next = { name: ex.data?.name ?? 'Exercise', logs: logs.data ?? [] }
      setData(next)
      writeJSON(cacheKey, next)
    })
    return () => {
      alive = false
    }
  }, [cacheKey, exerciseId, userId])

  const sessions: Session[] = []
  for (const l of data?.logs ?? []) {
    let s = sessions[sessions.length - 1]
    if (!s || s.date !== l.workout_date) {
      s = { date: l.workout_date, sets: [], top: null }
      sessions.push(s)
    }
    s.sets.push(l)
    if (l.weight !== null && (s.top === null || l.weight > s.top)) s.top = l.weight
  }
  const best = sessions.reduce<number | null>((m, s) => (s.top !== null && (m === null || s.top > m) ? s.top : m), null)
  const today = todayISO()

  return (
    <div className="page">
      <button className="btn-link back" onClick={() => (history.length > 1 ? navigate(-1) : navigate('/history'))}>
        <IconChevronLeft /> Back
      </button>
      <header className="page-head">
        <h1 className="page-title">{data?.name ?? ' '}</h1>
        {best !== null && (
          <p className="muted">
            Best: {formatWeight(best)} {unit} across {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
          </p>
        )}
      </header>

      {error && <p className="banner">{error}</p>}
      {!data && !error && <div className="loading-lines" aria-busy="true" aria-label="Loading" />}
      {data && sessions.length === 0 && (
        <div className="empty">
          <p className="empty-title">You haven't logged this exercise yet.</p>
        </div>
      )}

      <ol className="sessions">
        {sessions.map((s) => (
          <li key={s.date} className="session">
            <Link to={s.date === today ? '/' : `/day/${s.date}`} className="session-date">
              {formatShort(s.date)}
            </Link>
            <ul className="session-sets">
              {s.sets.map((l) => (
                <li key={l.set_number} className={l.weight !== null && l.weight === s.top ? 'is-top' : ''}>
                  <span className="figure">{formatWeight(l.weight)}</span>
                  {l.reps !== null && <span className="reps"> × {l.reps}</span>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  )
}
