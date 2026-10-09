import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { addDays, formatShort, todayISO } from '../../lib/dates'

type Row = { id: string; scheduled_date: string; title: string; workout_exercises: { count: number }[] }

export default function Schedule() {
  const navigate = useNavigate()
  const today = todayISO()
  const [weeksBack, setWeeksBack] = useState(4)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [date, setDate] = useState(today)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('workouts')
      .select('id, scheduled_date, title, workout_exercises(count)')
      .gte('scheduled_date', addDays(today, -7 * weeksBack))
      .order('scheduled_date')
      .order('created_at')
    if (error) return setError(error.message)
    setRows(data as unknown as Row[])
    setError(null)
  }, [today, weeksBack])

  useEffect(() => {
    void load()
  }, [load])

  async function create(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { data, error } = await supabase
      .from('workouts')
      .insert({ scheduled_date: date, title: title.trim() || 'Workout' })
      .select('id')
      .single()
    setBusy(false)
    if (error) return setError(error.message)
    navigate(`/admin/workout/${data.id}`)
  }

  const upcoming = (rows ?? []).filter((r) => r.scheduled_date >= today)
  const past = (rows ?? []).filter((r) => r.scheduled_date < today).reverse()

  return (
    <>
      <form className="panel stack" onSubmit={create}>
        <h2 className="section-title">New workout</h2>
        <div className="grid-2">
          <label className="field">
            <span className="field-label">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label className="field">
            <span className="field-label">Name</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lower body A" />
          </label>
        </div>
        <button className="btn btn-primary" disabled={busy || !date}>
          {busy ? 'Creating…' : 'Create and add exercises'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {rows === null && !error && <div className="loading-lines" aria-busy="true" />}

      {rows && (
        <>
          <h2 className="section-title">Upcoming</h2>
          {upcoming.length === 0 ? (
            <p className="muted">Nothing scheduled from today on. Create a workout above.</p>
          ) : (
            <WorkoutList rows={upcoming} today={today} />
          )}

          <h2 className="section-title">Past</h2>
          {past.length === 0 ? (
            <p className="muted">No workouts in the last {weeksBack} weeks.</p>
          ) : (
            <WorkoutList rows={past} today={today} />
          )}
          <button className="btn-link" onClick={() => setWeeksBack((w) => w + 8)}>
            Show older workouts
          </button>
        </>
      )}
    </>
  )
}

function WorkoutList({ rows, today }: { rows: Row[]; today: string }) {
  return (
    <ul className="list">
      {rows.map((r) => {
        const count = r.workout_exercises?.[0]?.count ?? 0
        return (
          <li key={r.id}>
            <Link to={`/admin/workout/${r.id}`} className="list-row">
              <span className="list-main">
                <span className="list-title">{r.title}</span>
                <span className="list-sub">
                  {r.scheduled_date === today ? 'Today' : formatShort(r.scheduled_date)}
                </span>
              </span>
              <span className={count ? 'list-meta' : 'list-meta warn'}>
                {count === 0 ? 'No exercises' : count === 1 ? '1 exercise' : `${count} exercises`}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
