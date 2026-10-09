// All dates in the app are local calendar dates as 'YYYY-MM-DD' strings.

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function isISODate(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseISODate(s).getTime())
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function addDays(s: string, n: number): string {
  const d = parseISODate(s)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

/** Monday of the week containing s. */
export function startOfWeek(s: string): string {
  const d = parseISODate(s)
  const dow = (d.getDay() + 6) % 7 // Mon=0 … Sun=6
  return addDays(s, -dow)
}

export function weekDates(s: string): string[] {
  const start = startOfWeek(s)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function formatLong(s: string): string {
  return parseISODate(s).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

export function formatShort(s: string, withYear = false): string {
  const d = parseISODate(s)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(withYear || !sameYear ? { year: 'numeric' } : {}),
  })
}

export function formatMonthDay(s: string): string {
  const d = parseISODate(s)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })
}

export function weekdayInitial(s: string): string {
  return parseISODate(s).toLocaleDateString(undefined, { weekday: 'short' })
}

export function dayOfMonth(s: string): number {
  return parseISODate(s).getDate()
}
