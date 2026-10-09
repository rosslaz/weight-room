import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useUser } from '../lib/auth'
import {
  formatWeight,
  loadDay,
  loadWeekDates,
  logsWithQueue,
  type DayData,
  type PrevSet,
  type SetLog,
  type WorkoutItem,
} from '../lib/data'
import { formatLong, formatMonthDay, formatShort, isISODate, todayISO } from '../lib/dates'
import { enqueue, flush } from '../lib/offline'
import WeekStrip from '../components/WeekStrip'
import { IconCheck, IconX } from '../components/Icons'

type Entry = { w: string; r: string }
const ek = (weId: string, n: number) => `${weId}:${n}`

export function parseWeight(s: string): number | null | 'invalid' {
  const t = s.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0 || n > 99999) return 'invalid'
  return Math.round(n * 100) / 100
}

export function parseReps(s: string): number | null | 'invalid' {
  const t = s.trim()
  if (!t) return null
  if (!/^\d+$/.test(t)) return 'invalid'
  const n = Number(t)
  return n > 1000 ? 'invalid' : n
}

export default function WorkoutDay() {
  const { date: param } = useParams()
  const today = todayISO()
  const date = isISODate(param) ? param : today
  const navigate = useNavigate()
  const { userId, profile } = useUser()
  const unit = profile?.unit ?? 'lb'

  const [day, setDay] = useState<DayData | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<Record<string, Entry>>({})
  const [shownRows, setShownRows] = useState<Record<string, number>>({})
  const [weekWorkouts, setWeekWorkouts] = useState<Set<string>>(new Set())

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true)
      await flush(userId)
      const res = await loadDay(userId, date)
      if (res.data) {
        const logs = logsWithQueue(userId, res.data)
        setDay(res.data)
        setFromCache(res.fromCache)
        setError(null)
        setEntries(entriesFromLogs(logs))
        setShownRows({})
      } else {
        setDay(null)
        setError(res.error)
      }
      setLoading(false)
    },
    [userId, date],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let alive = true
    void loadWeekDates(userId, date).then(({ dates }) => alive && setWeekWorkouts(new Set(dates)))
    return () => {
      alive = false
    }
  }, [userId, date])

  // Coming back to the app: pick up any changes the coach made.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void load(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  const goTo = (d: string) => navigate(d === today ? '/' : `/day/${d}`)

  const entriesRef = useRef(entries)
  useEffect(() => {
    entriesRef.current = entries
  }, [entries])

  // Every edit saves: a set counts as logged once it has a weight. Clearing the weight removes it.
  const updateEntry = useCallback(
    (item: WorkoutItem, n: number, next: Entry) => {
      const key = ek(item.id, n)
      const before = entriesRef.current[key] ?? { w: '', r: '' }
      const w = parseWeight(next.w)
      const r = parseReps(next.r)
      const wasLogged = typeof parseWeight(before.w) === 'number'
      const base = { workout_exercise_id: item.id, exercise_id: item.exercise_id, workout_date: date, set_number: n }
      if (typeof w === 'number' && r !== 'invalid') {
        enqueue(userId, { ...base, op: 'upsert', weight: w, reps: r })
      } else if (w === null && wasLogged) {
        enqueue(userId, { ...base, op: 'delete', weight: null, reps: null })
      }
      entriesRef.current = { ...entriesRef.current, [key]: next }
      setEntries((prev) => ({ ...prev, [key]: next }))
    },
    [userId, date],
  )

  const isToday = date === today

  return (
    <div className="page">
      <WeekStrip date={date} workoutDates={weekWorkouts} onSelect={goTo} />

      <header className="day-head">
        <h1 className="day-title">{isToday ? 'Today' : formatLong(date)}</h1>
        {isToday ? (
          <p className="day-sub">{formatLong(date)}</p>
        ) : (
          <button className="btn-link day-sub" onClick={() => goTo(today)}>
            Back to today
          </button>
        )}
      </header>

      {fromCache && (
        <p className="banner" role="status">
          No connection. This is the copy saved on your phone; sets you log upload when you're back online.
        </p>
      )}

      {loading && !day && <div className="loading-lines" aria-busy="true" aria-label="Loading workout" />}

      {error && (
        <div className="empty">
          <p>{error}</p>
          <button className="btn" onClick={() => void load()}>
            Try again
          </button>
        </div>
      )}

      {day && day.workouts.length === 0 && (
        <div className="empty">
          <p className="empty-title">Nothing on the board {isToday ? 'today' : 'this day'}.</p>
          {day.nextDate ? (
            <button className="btn" onClick={() => goTo(day.nextDate!)}>
              Next workout: {formatShort(day.nextDate)}
            </button>
          ) : (
            !fromCache && <p className="muted">No upcoming workouts are scheduled yet.</p>
          )}
        </div>
      )}

      {day?.workouts.map((w) => (
        <section key={w.id} className="workout" aria-labelledby={`w-${w.id}`}>
          <div className="workout-head">
            <h2 id={`w-${w.id}`} className="workout-title">
              {w.title}
            </h2>
            {w.notes && <p className="workout-notes">{w.notes}</p>}
          </div>
          {w.items.length === 0 && <p className="muted">No exercises in this workout yet.</p>}
          {w.items.map((item) => (
            <ExerciseBlock
              key={item.id}
              item={item}
              unit={unit}
              entries={entries}
              previous={day.previous.filter((p) => p.exercise_id === item.exercise_id)}
              minRows={shownRows[item.id] ?? 0}
              onChange={updateEntry}
              onAddRow={(current) => setShownRows((x) => ({ ...x, [item.id]: current + 1 }))}
              onRemoveRow={(n) => {
                updateEntry(item, n, { w: '', r: '' })
                setShownRows((x) => ({ ...x, [item.id]: n - 1 }))
                setEntries((prev) => {
                  const copy = { ...prev }
                  delete copy[ek(item.id, n)]
                  return copy
                })
              }}
            />
          ))}
        </section>
      ))}
    </div>
  )
}

function entriesFromLogs(logs: SetLog[]): Record<string, Entry> {
  const out: Record<string, Entry> = {}
  for (const l of logs) {
    out[ek(l.workout_exercise_id, l.set_number)] = {
      w: formatWeight(l.weight),
      r: l.reps === null ? '' : String(l.reps),
    }
  }
  return out
}

type BlockProps = {
  item: WorkoutItem
  unit: string
  entries: Record<string, Entry>
  previous: PrevSet[]
  minRows: number
  onChange: (item: WorkoutItem, n: number, e: Entry) => void
  onAddRow: (currentRows: number) => void
  onRemoveRow: (n: number) => void
}

function ExerciseBlock({ item, unit, entries, previous, minRows, onChange, onAddRow, onRemoveRow }: BlockProps) {
  const prevByN = useMemo(() => new Map(previous.map((p) => [p.set_number, p])), [previous])
  const lastPrev = previous.length ? previous[previous.length - 1] : undefined
  const targetRepsNum = item.target_reps && /^\d+$/.test(item.target_reps.trim()) ? item.target_reps.trim() : null

  // How many rows: the plan, anything already logged beyond it, plus rows the user added.
  let maxLogged = 0
  for (const key of Object.keys(entries)) {
    const [weId, n] = key.split(':')
    if (weId === item.id && entries[key].w + entries[key].r !== '') maxLogged = Math.max(maxLogged, Number(n))
  }
  const rows = Math.max(item.target_sets, maxLogged, minRows)
  const numbers = Array.from({ length: rows }, (_, i) => i + 1)

  const entry = (n: number): Entry => entries[ek(item.id, n)] ?? { w: '', r: '' }
  const loggedWeight = (n: number) => {
    const v = parseWeight(entry(n).w)
    return typeof v === 'number' ? v : null
  }

  const ghostW = (n: number): string => {
    const p = prevByN.get(n)?.weight ?? (n > 1 ? loggedWeight(n - 1) : null) ?? lastPrev?.weight ?? null
    return formatWeight(p)
  }
  const ghostR = (n: number): string => {
    if (targetRepsNum) return targetRepsNum
    const p = prevByN.get(n)?.reps ?? lastPrev?.reps ?? null
    return p === null ? '' : String(p)
  }

  const doneCount = numbers.filter((n) => n <= item.target_sets && loggedWeight(n) !== null).length
  const complete = doneCount >= item.target_sets

  const target = item.target_reps ? `${item.target_sets} × ${item.target_reps}` : `${item.target_sets} sets`
  const prevSummary = previous.length
    ? previous.map((p) => `${formatWeight(p.weight)}${p.reps !== null ? ` × ${p.reps}` : ''}`).join(', ')
    : null

  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  return (
    <article className={`ex ${complete ? 'ex-done' : ''}`}>
      <div className="ex-head">
        <Link to={`/history/${item.exercise_id}`} className="ex-name">
          {item.exercise.name}
        </Link>
        <span className="ex-target" aria-label={`Target ${target}`}>
          {target}
        </span>
      </div>
      {(item.notes || item.exercise.notes) && <p className="ex-notes">{item.notes || item.exercise.notes}</p>}
      <p className="ex-last">
        {prevSummary ? (
          <>
            Last time, {formatMonthDay(previous[0].workout_date)}: {prevSummary}
          </>
        ) : (
          'No history yet. Pick a starting weight.'
        )}
      </p>

      <div className="sets" role="table" aria-label={`${item.exercise.name} sets`}>
        <div className="sets-head" role="row">
          <span role="columnheader">Set</span>
          <span role="columnheader">Weight ({unit})</span>
          <span role="columnheader">Reps</span>
          <span role="columnheader" className="sr-only">
            Done
          </span>
        </div>
        {numbers.map((n) => {
          const e = entry(n)
          const w = parseWeight(e.w)
          const r = parseReps(e.r)
          const logged = typeof w === 'number'
          const gw = ghostW(n)
          const gr = ghostR(n)
          const removable = n === rows && n > item.target_sets && n > 1
          return (
            <div key={n} role="row" className={`set ${logged ? 'set-logged' : ''}`}>
              <span role="cell" className="set-n">
                {n}
              </span>
              <span role="cell">
                <input
                  ref={(el) => {
                    inputRefs.current[n] = el
                  }}
                  className={`num ${w === 'invalid' ? 'num-bad' : ''}`}
                  inputMode="decimal"
                  enterKeyHint="next"
                  autoComplete="off"
                  aria-label={`Set ${n} weight in ${unit}`}
                  placeholder={gw}
                  value={e.w}
                  onChange={(ev) => onChange(item, n, { ...e, w: ev.target.value })}
                />
              </span>
              <span role="cell">
                <input
                  className={`num ${r === 'invalid' ? 'num-bad' : ''}`}
                  inputMode="numeric"
                  enterKeyHint="done"
                  autoComplete="off"
                  aria-label={`Set ${n} reps`}
                  placeholder={gr}
                  value={e.r}
                  onChange={(ev) => onChange(item, n, { ...e, r: ev.target.value.replace(/[^\d]/g, '') })}
                />
              </span>
              <span role="cell" className="set-action">
                {removable && !logged ? (
                  <button className="icon-btn set-remove" onClick={() => onRemoveRow(n)} aria-label={`Remove set ${n}`}>
                    <IconX />
                  </button>
                ) : (
                  <button
                    className={`check ${logged ? 'check-on' : ''}`}
                    aria-pressed={logged}
                    aria-label={
                      logged ? `Set ${n} logged` : gw ? `Log set ${n} at ${gw} ${unit}${gr ? ` for ${gr} reps` : ''}` : `Log set ${n}`
                    }
                    onClick={() => {
                      if (logged) {
                        if (!e.r && gr) onChange(item, n, { ...e, r: gr })
                        return
                      }
                      if (!gw && w === null) {
                        inputRefs.current[n]?.focus()
                        return
                      }
                      onChange(item, n, { w: e.w || gw, r: e.r || gr })
                    }}
                  >
                    <IconCheck />
                  </button>
                )}
              </span>
            </div>
          )
        })}
      </div>
      <button className="btn-link add-set" onClick={() => onAddRow(rows)}>
        Add a set
      </button>
    </article>
  )
}
