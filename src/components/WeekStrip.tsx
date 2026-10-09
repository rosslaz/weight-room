import { addDays, dayOfMonth, formatMonthDay, todayISO, weekDates, weekdayInitial } from '../lib/dates'
import { IconChevronLeft, IconChevronRight } from './Icons'

type Props = {
  date: string
  workoutDates: Set<string>
  onSelect: (date: string) => void
}

export default function WeekStrip({ date, workoutDates, onSelect }: Props) {
  const days = weekDates(date)
  const today = todayISO()
  return (
    <div className="week">
      <button className="icon-btn" onClick={() => onSelect(addDays(date, -7))} aria-label="Previous week">
        <IconChevronLeft />
      </button>
      <ol className="week-days">
        {days.map((d) => {
          const cls = ['week-day']
          if (d === date) cls.push('is-selected')
          if (d === today) cls.push('is-today')
          if (workoutDates.has(d)) cls.push('has-workout')
          return (
            <li key={d}>
              <button
                className={cls.join(' ')}
                onClick={() => onSelect(d)}
                aria-current={d === date ? 'date' : undefined}
                aria-label={`${formatMonthDay(d)}${workoutDates.has(d) ? ', workout scheduled' : ''}${d === today ? ', today' : ''}`}
              >
                <span className="week-dow">{weekdayInitial(d)}</span>
                <span className="week-num">{dayOfMonth(d)}</span>
                <span className="week-dot" aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ol>
      <button className="icon-btn" onClick={() => onSelect(addDays(date, 7))} aria-label="Next week">
        <IconChevronRight />
      </button>
    </div>
  )
}
