import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { normalizeWorkouts, type Exercise, type Workout, type WorkoutItem } from '../../lib/data'
import { addDays, formatShort, todayISO } from '../../lib/dates'
import { IconChevronLeft, IconDown, IconUp, IconX } from '../../components/Icons'

export default function WorkoutEditor() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [library, setLibrary] = useState<Exercise[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    const [w, ex] = await Promise.all([
      supabase.from('workouts').select('*, workout_exercises(*, exercises(*))').eq('id', id).maybeSingle(),
      supabase.from('exercises').select('*').eq('archived', false).order('name'),
    ])
    if (w.error) return setError(w.error.message)
    if (!w.data) return setNotFound(true)
    setWorkout(normalizeWorkouts([w.data as Parameters<typeof normalizeWorkouts>[0][number]])[0])
    setLibrary(ex.data ?? [])
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (notFound)
    return (
      <div className="empty">
        <p className="empty-title">That workout no longer exists.</p>
        <Link to="/admin" className="btn">
          Back to schedule
        </Link>
      </div>
    )
  if (!workout) return error ? <p className="error">{error}</p> : <div className="loading-lines" aria-busy="true" />

  return (
    <div className="editor" key={workout.id}>
      <Link to="/admin" className="btn-link back">
        <IconChevronLeft /> Schedule
      </Link>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <Details workout={workout} onSaved={load} onError={setError} />
      <Items workout={workout} library={library} onChanged={load} onError={setError} />
      <CopyAndDelete workout={workout} onError={setError} navigate={navigate} />
    </div>
  )
}

function Details({ workout, onSaved, onError }: { workout: Workout; onSaved: () => void; onError: (e: string) => void }) {
  const [date, setDate] = useState(workout.scheduled_date)
  const [title, setTitle] = useState(workout.title)
  const [notes, setNotes] = useState(workout.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const dirty = date !== workout.scheduled_date || title !== workout.title || notes !== (workout.notes ?? '')

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase
      .from('workouts')
      .update({ scheduled_date: date, title: title.trim() || 'Workout', notes: notes.trim() || null })
      .eq('id', workout.id)
    setBusy(false)
    if (error) return onError(error.message)
    setSaved(true)
    onSaved()
  }

  return (
    <form className="panel stack" onSubmit={save} onChange={() => setSaved(false)}>
      <div className="grid-2">
        <label className="field">
          <span className="field-label">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="field">
          <span className="field-label">Name</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Notes for everyone</span>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Warm up 10 min first" />
      </label>
      <div className="row">
        <button className="btn btn-primary" disabled={!dirty || busy}>
          {busy ? 'Saving…' : 'Save details'}
        </button>
        {saved && !dirty && <span className="note">Saved</span>}
      </div>
    </form>
  )
}

function Items({
  workout,
  library,
  onChanged,
  onError,
}: {
  workout: Workout
  library: Exercise[]
  onChanged: () => void
  onError: (e: string) => void
}) {
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const items = workout.items

  const match = useMemo(
    () => library.find((e) => e.name.trim().toLowerCase() === query.trim().toLowerCase()),
    [library, query],
  )

  async function add(e: FormEvent) {
    e.preventDefault()
    const name = query.trim()
    if (!name) return
    setBusy(true)
    let exerciseId = match?.id
    if (!exerciseId) {
      const { data, error } = await supabase.from('exercises').insert({ name }).select('id').single()
      if (error) {
        setBusy(false)
        return onError(
          error.code === '23505' ? `"${name}" is archived. Restore it on the Exercises tab to use it again.` : error.message,
        )
      }
      exerciseId = data.id
    }
    const position = items.length ? Math.max(...items.map((i) => i.position)) + 1 : 0
    const { error } = await supabase
      .from('workout_exercises')
      .insert({ workout_id: workout.id, exercise_id: exerciseId, position, target_sets: 3 })
    setBusy(false)
    if (error) return onError(error.message)
    setQuery('')
    onChanged()
  }

  async function move(index: number, dir: -1 | 1) {
    const a = items[index]
    const b = items[index + dir]
    if (!a || !b) return
    const r1 = await supabase.from('workout_exercises').update({ position: b.position }).eq('id', a.id)
    const r2 = await supabase.from('workout_exercises').update({ position: a.position }).eq('id', b.id)
    if (r1.error || r2.error) onError((r1.error || r2.error)!.message)
    onChanged()
  }

  return (
    <section className="stack">
      <h2 className="section-title">Exercises</h2>
      {items.length === 0 && <p className="muted">Add the first exercise below.</p>}
      <ol className="edit-items">
        {items.map((item, i) => (
          <ItemRow
            key={item.id}
            item={item}
            first={i === 0}
            last={i === items.length - 1}
            onMove={(d) => void move(i, d)}
            onChanged={onChanged}
            onError={onError}
          />
        ))}
      </ol>

      <form className="panel stack" onSubmit={add}>
        <label className="field">
          <span className="field-label">Add an exercise</span>
          <input
            list="exercise-library"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Start typing, e.g. Back squat"
            autoComplete="off"
          />
          <datalist id="exercise-library">
            {library.map((e) => (
              <option key={e.id} value={e.name} />
            ))}
          </datalist>
        </label>
        <button className="btn" disabled={busy || !query.trim()}>
          {busy ? 'Adding…' : match || !query.trim() ? 'Add exercise' : `Create "${query.trim()}" and add`}
        </button>
        <p className="hint">Use the same exercise name each time so last time's weights carry over.</p>
      </form>
    </section>
  )
}

function ItemRow({
  item,
  first,
  last,
  onMove,
  onChanged,
  onError,
}: {
  item: WorkoutItem
  first: boolean
  last: boolean
  onMove: (dir: -1 | 1) => void
  onChanged: () => void
  onError: (e: string) => void
}) {
  const [sets, setSets] = useState(String(item.target_sets))
  const [reps, setReps] = useState(item.target_reps ?? '')
  const [notes, setNotes] = useState(item.notes ?? '')
  const [confirmRemove, setConfirmRemove] = useState(false)

  async function save(fields: { target_sets?: number; target_reps?: string | null; notes?: string | null }) {
    const { error } = await supabase.from('workout_exercises').update(fields).eq('id', item.id)
    if (error) onError(error.message)
  }

  async function remove() {
    const { error } = await supabase.from('workout_exercises').delete().eq('id', item.id)
    if (error) return onError(error.message)
    onChanged()
  }

  return (
    <li className="edit-item">
      <div className="edit-item-head">
        <span className="edit-item-name">{item.exercise.name}</span>
        <span className="edit-item-tools">
          <button className="icon-btn" onClick={() => onMove(-1)} disabled={first} aria-label="Move up">
            <IconUp />
          </button>
          <button className="icon-btn" onClick={() => onMove(1)} disabled={last} aria-label="Move down">
            <IconDown />
          </button>
          {confirmRemove ? (
            <button className="btn btn-danger btn-small" onClick={() => void remove()}>
              Remove
            </button>
          ) : (
            <button className="icon-btn" onClick={() => setConfirmRemove(true)} aria-label={`Remove ${item.exercise.name}`}>
              <IconX />
            </button>
          )}
        </span>
      </div>
      <div className="grid-3">
        <label className="field">
          <span className="field-label">Sets</span>
          <input
            inputMode="numeric"
            value={sets}
            onChange={(e) => setSets(e.target.value.replace(/\D/g, ''))}
            onBlur={() => {
              const n = Math.min(20, Math.max(1, Number(sets) || 1))
              setSets(String(n))
              if (n !== item.target_sets) void save({ target_sets: n })
            }}
          />
        </label>
        <label className="field">
          <span className="field-label">Reps</span>
          <input
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            placeholder="8"
            onBlur={() => reps.trim() !== (item.target_reps ?? '') && void save({ target_reps: reps.trim() || null })}
          />
        </label>
        <label className="field">
          <span className="field-label">Note</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
            onBlur={() => notes.trim() !== (item.notes ?? '') && void save({ notes: notes.trim() || null })}
          />
        </label>
      </div>
      {confirmRemove && (
        <p className="hint">
          Weights people already logged for it are kept in their history.{' '}
          <button className="btn-link" onClick={() => setConfirmRemove(false)}>
            Keep it
          </button>
        </p>
      )}
    </li>
  )
}

function CopyAndDelete({
  workout,
  onError,
  navigate,
}: {
  workout: Workout
  onError: (e: string) => void
  navigate: (to: string) => void
}) {
  const [copyDate, setCopyDate] = useState(() => addDays(workout.scheduled_date > todayISO() ? workout.scheduled_date : todayISO(), 7))
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function copy(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { data, error } = await supabase
      .from('workouts')
      .insert({ scheduled_date: copyDate, title: workout.title, notes: workout.notes })
      .select('id')
      .single()
    if (error) {
      setBusy(false)
      return onError(error.message)
    }
    if (workout.items.length) {
      const res = await supabase.from('workout_exercises').insert(
        workout.items.map((i) => ({
          workout_id: data.id,
          exercise_id: i.exercise_id,
          position: i.position,
          target_sets: i.target_sets,
          target_reps: i.target_reps,
          notes: i.notes,
        })),
      )
      if (res.error) {
        setBusy(false)
        return onError(res.error.message)
      }
    }
    setBusy(false)
    navigate(`/admin/workout/${data.id}`)
  }

  async function remove() {
    const { error } = await supabase.from('workouts').delete().eq('id', workout.id)
    if (error) return onError(error.message)
    navigate('/admin')
  }

  return (
    <section className="stack">
      <form className="panel stack" onSubmit={copy}>
        <h2 className="section-title">Repeat this workout</h2>
        <div className="row">
          <label className="field grow">
            <span className="field-label">On</span>
            <input type="date" value={copyDate} onChange={(e) => setCopyDate(e.target.value)} required />
          </label>
          <button className="btn" disabled={busy}>
            {busy ? 'Copying…' : `Copy to ${copyDate ? formatShort(copyDate) : 'date'}`}
          </button>
        </div>
      </form>

      <div className="danger-zone">
        {confirmDelete ? (
          <>
            <p>
              Delete "{workout.title}" on {formatShort(workout.scheduled_date)}? Weights people logged stay in their
              history.
            </p>
            <div className="row">
              <button className="btn btn-danger" onClick={() => void remove()}>
                Delete workout
              </button>
              <button className="btn" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <button className="btn-link danger" onClick={() => setConfirmDelete(true)}>
            Delete this workout
          </button>
        )}
      </div>
    </section>
  )
}
