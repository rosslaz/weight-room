import { supabase, isNetworkError } from './supabase'

// ---------- tiny localStorage helpers (storage can be full or blocked) ----------
export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or unavailable: the app still works online */
  }
}

// ---------- upload queue ----------
// Every set change goes into this queue first, then uploads. With no signal the
// queue just waits, and it's retried when the phone reconnects.

export type QueueItem = {
  key: string // `${workout_exercise_id}:${set_number}` — later edits replace earlier ones
  op: 'upsert' | 'delete'
  workout_exercise_id: string
  exercise_id: string
  workout_date: string
  set_number: number
  weight: number | null
  reps: number | null
  queuedAt: number
}

export const QUEUE_EVENT = 'wr:queue'
const queueKey = (uid: string) => `wr:${uid}:queue`
const failedKey = (uid: string) => `wr:${uid}:failed`

export function getQueue(uid: string): QueueItem[] {
  return readJSON<QueueItem[]>(queueKey(uid), [])
}

function setQueue(uid: string, items: QueueItem[]) {
  writeJSON(queueKey(uid), items)
  window.dispatchEvent(new CustomEvent(QUEUE_EVENT))
}

export function enqueue(uid: string, item: Omit<QueueItem, 'key' | 'queuedAt'>): void {
  const key = `${item.workout_exercise_id}:${item.set_number}`
  const rest = getQueue(uid).filter((q) => q.key !== key)
  setQueue(uid, [...rest, { ...item, key, queuedAt: Date.now() }])
  scheduleFlush(uid)
}

export function getFailedCount(uid: string): number {
  return readJSON<QueueItem[]>(failedKey(uid), []).length
}

export function clearFailed(uid: string): void {
  writeJSON(failedKey(uid), [])
  window.dispatchEvent(new CustomEvent(QUEUE_EVENT))
}

let flushTimer: number | undefined
let flushing: Promise<void> | null = null
let onFlushed: ((uid: string, items: QueueItem[]) => void) | null = null

export function setOnFlushed(fn: (uid: string, items: QueueItem[]) => void) {
  onFlushed = fn
}

export function scheduleFlush(uid: string, delay = 1200) {
  window.clearTimeout(flushTimer)
  flushTimer = window.setTimeout(() => void flush(uid), delay)
}

export function isFlushing() {
  return flushing !== null
}

export async function flush(uid: string): Promise<void> {
  if (flushing) return flushing
  flushing = doFlush(uid).finally(() => {
    flushing = null
    window.dispatchEvent(new CustomEvent(QUEUE_EVENT))
  })
  window.dispatchEvent(new CustomEvent(QUEUE_EVENT))
  return flushing
}

async function sendItem(uid: string, it: QueueItem) {
  if (it.op === 'upsert') {
    return supabase.from('set_logs').upsert(
      {
        user_id: uid,
        workout_exercise_id: it.workout_exercise_id,
        exercise_id: it.exercise_id,
        workout_date: it.workout_date,
        set_number: it.set_number,
        weight: it.weight,
        reps: it.reps,
      },
      { onConflict: 'user_id,workout_exercise_id,set_number' },
    )
  }
  return supabase
    .from('set_logs')
    .delete()
    .eq('user_id', uid)
    .eq('workout_exercise_id', it.workout_exercise_id)
    .eq('set_number', it.set_number)
}

async function doFlush(uid: string): Promise<void> {
  const items = getQueue(uid)
  if (!items.length || !navigator.onLine) return

  const done: QueueItem[] = []
  const failed: QueueItem[] = []

  const ups = items.filter((i) => i.op === 'upsert')
  const dels = items.filter((i) => i.op === 'delete')

  if (ups.length) {
    const { error } = await supabase.from('set_logs').upsert(
      ups.map((it) => ({
        user_id: uid,
        workout_exercise_id: it.workout_exercise_id,
        exercise_id: it.exercise_id,
        workout_date: it.workout_date,
        set_number: it.set_number,
        weight: it.weight,
        reps: it.reps,
      })),
      { onConflict: 'user_id,workout_exercise_id,set_number' },
    )
    if (!error) done.push(...ups)
    else if (isNetworkError(error)) return
    else {
      // One bad row (e.g. the coach deleted that workout) shouldn't block the rest.
      for (const it of ups) {
        const res = await sendItem(uid, it)
        if (!res.error) done.push(it)
        else if (isNetworkError(res.error)) return
        else failed.push(it)
      }
    }
  }

  for (const it of dels) {
    const res = await sendItem(uid, it)
    if (!res.error) done.push(it)
    else if (isNetworkError(res.error)) break
    else failed.push(it)
  }

  // Drop what was sent, unless it was edited again while uploading.
  const sent = new Set([...done, ...failed].map((i) => `${i.key}@${i.queuedAt}`))
  setQueue(
    uid,
    getQueue(uid).filter((q) => !sent.has(`${q.key}@${q.queuedAt}`)),
  )
  if (failed.length) writeJSON(failedKey(uid), [...readJSON<QueueItem[]>(failedKey(uid), []), ...failed])
  if (done.length) onFlushed?.(uid, done)
}
