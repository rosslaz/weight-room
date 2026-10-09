import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { Exercise } from '../../lib/data'

export default function Exercises() {
  const [rows, setRows] = useState<Exercise[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('exercises').select('*').order('name')
    if (error) return setError(error.message)
    setRows(data)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    const { error } = await supabase.from('exercises').insert({ name: name.trim(), notes: notes.trim() || null })
    setBusy(false)
    if (error) return setError(error.code === '23505' ? `There's already an exercise called "${name.trim()}".` : error.message)
    setName('')
    setNotes('')
    setError(null)
    void load()
  }

  const active = (rows ?? []).filter((r) => !r.archived)
  const archived = (rows ?? []).filter((r) => r.archived)

  return (
    <>
      <form className="panel stack" onSubmit={add}>
        <h2 className="section-title">New exercise</h2>
        <label className="field">
          <span className="field-label">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Romanian deadlift" />
        </label>
        <label className="field">
          <span className="field-label">Default note</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional, e.g. 3 sec lower" />
        </label>
        <button className="btn btn-primary" disabled={busy || !name.trim()}>
          {busy ? 'Adding…' : 'Add exercise'}
        </button>
      </form>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {rows === null && !error && <div className="loading-lines" aria-busy="true" />}

      {rows && (
        <>
          <h2 className="section-title">Library ({active.length})</h2>
          {active.length === 0 && <p className="muted">No exercises yet.</p>}
          <ul className="list">
            {active.map((ex) => (
              <ExerciseRow key={ex.id} ex={ex} onChanged={load} onError={setError} />
            ))}
          </ul>

          {archived.length > 0 && (
            <>
              <button className="btn-link" onClick={() => setShowArchived((v) => !v)}>
                {showArchived ? 'Hide archived' : `Show archived (${archived.length})`}
              </button>
              {showArchived && (
                <ul className="list">
                  {archived.map((ex) => (
                    <ExerciseRow key={ex.id} ex={ex} onChanged={load} onError={setError} />
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </>
  )
}

function ExerciseRow({ ex, onChanged, onError }: { ex: Exercise; onChanged: () => void; onError: (e: string) => void }) {
  const [name, setName] = useState(ex.name)
  const [notes, setNotes] = useState(ex.notes ?? '')
  const [editing, setEditing] = useState(false)

  async function save() {
    const { error } = await supabase
      .from('exercises')
      .update({ name: name.trim() || ex.name, notes: notes.trim() || null })
      .eq('id', ex.id)
    if (error) return onError(error.code === '23505' ? `There's already an exercise called "${name.trim()}".` : error.message)
    setEditing(false)
    onChanged()
  }

  async function setArchived(archived: boolean) {
    const { error } = await supabase.from('exercises').update({ archived }).eq('id', ex.id)
    if (error) return onError(error.message)
    onChanged()
  }

  async function remove() {
    const { error } = await supabase.from('exercises').delete().eq('id', ex.id)
    if (error)
      return onError(
        error.code === '23503'
          ? `"${ex.name}" is in a workout or someone has logged it, so it can't be deleted. It stays archived.`
          : error.message,
      )
    onChanged()
  }

  if (editing)
    return (
      <li className="list-row list-edit">
        <div className="stack grow">
          <label className="field">
            <span className="field-label">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <label className="field">
            <span className="field-label">Default note</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <p className="hint">Renaming updates every workout that uses it. History is kept.</p>
          <div className="row">
            <button className="btn btn-primary" onClick={() => void save()}>
              Save
            </button>
            <button
              className="btn"
              onClick={() => {
                setName(ex.name)
                setNotes(ex.notes ?? '')
                setEditing(false)
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </li>
    )

  return (
    <li className="list-row">
      <span className="list-main">
        <span className="list-title">{ex.name}</span>
        {ex.notes && <span className="list-sub">{ex.notes}</span>}
      </span>
      <span className="row-tight">
        {ex.archived ? (
          <>
            <button className="btn btn-small" onClick={() => void setArchived(false)}>
              Restore
            </button>
            <button className="btn btn-small btn-danger-outline" onClick={() => void remove()}>
              Delete
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-small" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button className="btn btn-small" onClick={() => void setArchived(true)}>
              Archive
            </button>
          </>
        )}
      </span>
    </li>
  )
}
