import type { Row } from './database.types'
import { supabase, isNetworkError } from './supabase'
import { addDays, startOfWeek } from './dates'
import { readJSON, writeJSON, getQueue, type QueueItem } from './offline'

export type Exercise = Row<'exercises'>
export type Profile = Row<'profiles'>
export type WorkoutItem = Row<'workout_exercises'> & { exercise: Exercise }
export type Workout = Row<'workouts'> & { items: WorkoutItem[] }

export type SetLog = {
  workout_exercise_id: string
  exercise_id: string
  workout_date: string
  set_number: number
  weight: number | null
  reps: number | null
}

export type PrevSet = {
  exercise_id: string
  workout_date: string
  set_number: number
  weight: number | null
  reps: number | null
}

export type DayData = {
  date: string
  workouts: Workout[]
  logs: SetLog[]
  previous: PrevSet[]
  nextDate: string | null
  fetchedAt: number
}

export type LoadResult<T> = { data: T; fromCache: boolean } | { data: null; fromCache: false; error: string }

const dayKey = (uid: string, date: string) => `wr:${uid}:day:${date}`
const weekKey = (uid: string, monday: string) => `wr:${uid}:week:${monday}`

type RawWorkout = Row<'workouts'> & {
  workout_exercises: (Row<'workout_exercises'> & { exercises: Exercise | null })[]
}

export function normalizeWorkouts(rows: RawWorkout[]): Workout[] {
  return rows.map(({ workout_exercises, ...w }) => ({
    ...w,
    items: (workout_exercises ?? [])
      .filter((we) => we.exercises)
      .sort((a, b) => a.position - b.position)
      .map(({ exercises, ...we }) => ({ ...we, exercise: exercises as Exercise })),
  }))
}

async function fetchDayFromServer(uid: string, date: string): Promise<DayData> {
  const { data: rows, error } = await supabase
    .from('workouts')
    .select('*, workout_exercises(*, exercises(*))')
    .eq('scheduled_date', date)
    .order('created_at')
  if (error) throw error
  const workouts = normalizeWorkouts(rows as RawWorkout[])
  const items = workouts.flatMap((w) => w.items)
  const weIds = items.map((i) => i.id)
  const exIds = [...new Set(items.map((i) => i.exercise_id))]

  let logs: SetLog[] = []
  let previous: PrevSet[] = []
  let nextDate: string | null = null

  if (weIds.length) {
    const [logsRes, prevRes] = await Promise.all([
      supabase
        .from('set_logs')
        .select('workout_exercise_id, exercise_id, workout_date, set_number, weight, reps')
        .eq('user_id', uid)
        .in('workout_exercise_id', weIds),
      supabase.rpc('previous_sets', { p_exercise_ids: exIds, p_before: date }),
    ])
    if (logsRes.error) throw logsRes.error
    if (prevRes.error) throw prevRes.error
    logs = (logsRes.data ?? []) as SetLog[]
    previous = prevRes.data ?? []
  } else {
    const { data: next, error: nextErr } = await supabase
      .from('workouts')
      .select('scheduled_date')
      .gt('scheduled_date', date)
      .order('scheduled_date')
      .limit(1)
    if (nextErr) throw nextErr
    nextDate = next?.[0]?.scheduled_date ?? null
  }

  return { date, workouts, logs, previous, nextDate, fetchedAt: Date.now() }
}

/** Loads a day's workouts, this user's logs, and last-time suggestions. Falls back to the on-device copy offline. */
export async function loadDay(uid: string, date: string): Promise<LoadResult<DayData>> {
  try {
    const data = await fetchDayFromServer(uid, date)
    writeJSON(dayKey(uid, date), data)
    return { data, fromCache: false }
  } catch (e) {
    const cached = readJSON<DayData | null>(dayKey(uid, date), null)
    if (cached) return { data: cached, fromCache: true }
    const err = e as { message?: string; code?: string }
    return {
      data: null,
      fromCache: false,
      error: isNetworkError(err)
        ? "You're offline and this day hasn't been opened on this phone yet."
        : err.message || 'Could not load this day.',
    }
  }
}

/** Dates in the week (Mon–Sun) that have a workout scheduled. */
export async function loadWeekDates(uid: string, anyDate: string): Promise<{ dates: string[]; fromCache: boolean }> {
  const monday = startOfWeek(anyDate)
  try {
    const { data, error } = await supabase
      .from('workouts')
      .select('scheduled_date')
      .gte('scheduled_date', monday)
      .lte('scheduled_date', addDays(monday, 6))
    if (error) throw error
    const dates = [...new Set((data ?? []).map((r) => r.scheduled_date))]
    writeJSON(weekKey(uid, monday), dates)
    return { dates, fromCache: false }
  } catch {
    return { dates: readJSON<string[]>(weekKey(uid, monday), []), fromCache: true }
  }
}

/** Saves the next week of workouts on the phone so the app works with no signal at the gym. */
export async function prefetchUpcoming(uid: string, fromDate: string): Promise<void> {
  if (!navigator.onLine) return
  const { data, error } = await supabase
    .from('workouts')
    .select('scheduled_date')
    .gte('scheduled_date', fromDate)
    .lte('scheduled_date', addDays(fromDate, 7))
  if (error || !data) return
  const dates = [...new Set(data.map((r) => r.scheduled_date))]
  for (const d of dates) {
    await loadDay(uid, d)
  }
  await loadWeekDates(uid, fromDate)
  await loadWeekDates(uid, addDays(fromDate, 7))
}

/** Writes uploaded sets into the on-device copy so an offline reload still shows them. */
export function applyToCachedDays(uid: string, items: QueueItem[]): void {
  const byDate = new Map<string, QueueItem[]>()
  for (const it of items) byDate.set(it.workout_date, [...(byDate.get(it.workout_date) ?? []), it])
  for (const [date, its] of byDate) {
    const cached = readJSON<DayData | null>(dayKey(uid, date), null)
    if (!cached) continue
    cached.logs = mergeQueue(cached.logs, its)
    writeJSON(dayKey(uid, date), cached)
  }
}

/** Server logs with this phone's not-yet-uploaded changes laid on top. */
export function mergeQueue(logs: SetLog[], queue: QueueItem[]): SetLog[] {
  const map = new Map(logs.map((l) => [`${l.workout_exercise_id}:${l.set_number}`, l]))
  for (const q of queue) {
    const k = `${q.workout_exercise_id}:${q.set_number}`
    if (q.op === 'delete') map.delete(k)
    else
      map.set(k, {
        workout_exercise_id: q.workout_exercise_id,
        exercise_id: q.exercise_id,
        workout_date: q.workout_date,
        set_number: q.set_number,
        weight: q.weight,
        reps: q.reps,
      })
  }
  return [...map.values()]
}

export function logsWithQueue(uid: string, data: DayData): SetLog[] {
  const weIds = new Set(data.workouts.flatMap((w) => w.items.map((i) => i.id)))
  return mergeQueue(
    data.logs,
    getQueue(uid).filter((q) => weIds.has(q.workout_exercise_id)),
  )
}

export function formatWeight(n: number | null | undefined): string {
  if (n === null || n === undefined) return ''
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)))
}
