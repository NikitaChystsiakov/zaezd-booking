'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, eachDay, toDate, toISO, type ISODate } from '@/lib/dates'

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']

type Props = {
  today: ISODate
  checkIn: ISODate | null
  checkOut: ISODate | null
  /** Занятые ночи. null — владелец не показывает занятость */
  busy: Set<ISODate> | null
  /** Площадка на один день: клик сразу выбирает день */
  singleDay?: boolean
  onChange: (checkIn: ISODate | null, checkOut: ISODate | null) => void
}

function monthStart(iso: ISODate): ISODate {
  return `${iso.slice(0, 7)}-01`
}

function addMonths(iso: ISODate, n: number): ISODate {
  const d = toDate(iso)
  d.setUTCMonth(d.getUTCMonth() + n, 1)
  return toISO(d)
}

function monthGrid(first: ISODate): (ISODate | null)[] {
  const d = toDate(first)
  const offset = (d.getUTCDay() + 6) % 7 // неделя с понедельника
  const days = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  const cells: (ISODate | null)[] = Array(offset).fill(null)
  for (let i = 0; i < days; i++) cells.push(addDays(first, i))
  return cells
}

export function RangeCalendar({ today, checkIn, checkOut, busy, singleDay, onChange }: Props) {
  const [view, setView] = useState(() => monthStart(checkIn ?? today))
  const [hover, setHover] = useState<ISODate | null>(null)
  const months = useMemo(() => [view, addMonths(view, 1)], [view])

  const picking = checkIn && !checkOut
  const rangeEnd = checkOut ?? (picking && hover && hover > checkIn ? hover : null)

  function rangeHasBusy(from: ISODate, to: ISODate) {
    return busy ? eachDay(from, to).some((d) => busy.has(d)) : false
  }

  function click(d: ISODate) {
    if (singleDay) {
      onChange(d, addDays(d, 1))
      return
    }
    if (!checkIn || checkOut || d <= checkIn) {
      onChange(d, null)
      return
    }
    if (rangeHasBusy(checkIn, d)) {
      onChange(d, null)
      return
    }
    onChange(checkIn, d)
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          aria-label="Предыдущий месяц"
          className="grid size-8 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 disabled:opacity-30"
          disabled={view <= monthStart(today)}
          onClick={() => setView(addMonths(view, -1))}
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1" />
        <button
          type="button"
          aria-label="Следующий месяц"
          className="grid size-8 place-items-center rounded-lg text-ink-2 hover:bg-surface-2"
          onClick={() => setView(addMonths(view, 1))}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {months.map((m, mi) => (
          <div key={m} className={mi === 1 ? 'hidden sm:block' : ''}>
            <div className="mb-2 text-sm font-semibold">
              {MONTHS[toDate(m).getUTCMonth()]} {toDate(m).getUTCFullYear()}
            </div>
            <div className="grid grid-cols-7 text-center text-[11px] uppercase text-ink-3">
              {WD.map((w) => (
                <div key={w} className="pb-1">{w}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthGrid(m).map((d, i) => {
                if (!d) return <div key={`e${i}`} />
                const past = d < today
                const isBusy = busy?.has(d) ?? false
                // День выезда может совпадать с чужим заездом — блокируем только ночь
                const disabled = past || (isBusy && !(picking && d > checkIn!))
                const isStart = d === checkIn
                const isEnd = d === rangeEnd
                const inRange = checkIn && rangeEnd && d > checkIn && d < rangeEnd
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={disabled}
                    onClick={() => click(d)}
                    onMouseEnter={() => setHover(d)}
                    aria-pressed={isStart || isEnd}
                    aria-label={`${d}${isBusy ? ', занято' : ''}`}
                    className={[
                      'relative h-10 text-sm tabular-nums transition-colors',
                      inRange ? 'bg-accent-soft' : '',
                      isStart && rangeEnd ? 'rounded-l-lg bg-accent-soft' : '',
                      isEnd ? 'rounded-r-lg bg-accent-soft' : '',
                      disabled ? 'cursor-not-allowed text-ink-3/60' : 'hover:text-accent',
                      isBusy && !past ? 'line-through decoration-ink-3' : '',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'mx-auto grid size-9 place-items-center rounded-lg',
                        isStart || isEnd ? 'bg-accent font-semibold text-accent-ink' : '',
                        d === today && !isStart ? 'ring-1 ring-line-strong' : '',
                      ].join(' ')}
                    >
                      {Number(d.slice(8))}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
