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
  holidays?: Set<ISODate>
  /** Цена ночи для подсказки в ячейке; null — не показывать */
  priceFor?: ((date: ISODate) => number | null) | null
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

export function RangeCalendar({ today, checkIn, checkOut, busy, holidays, priceFor, onChange }: Props) {
  const [view, setView] = useState(() => monthStart(checkIn ?? today))
  const [hover, setHover] = useState<ISODate | null>(null)
  const months = useMemo(() => [view, addMonths(view, 1)], [view])

  const picking = checkIn && !checkOut
  const rangeEnd = checkOut ?? (picking && hover && hover > checkIn ? hover : null)

  function rangeHasBusy(from: ISODate, to: ISODate) {
    return busy ? eachDay(from, to).some((d) => busy.has(d)) : false
  }

  function click(d: ISODate) {
    if (!checkIn || checkOut || d <= checkIn || rangeHasBusy(checkIn, d)) {
      onChange(d, null)
      return
    }
    onChange(checkIn, d)
  }

  return (
    <div>
      <div className="grid gap-8 sm:grid-cols-2">
        {months.map((m, mi) => (
          <div key={m} className={mi === 1 ? 'hidden sm:block' : ''}>
            <div className="mb-3 flex h-8 items-center justify-between">
              {mi === 0 ? (
                <button
                  type="button"
                  aria-label="Предыдущий месяц"
                  className="grid size-8 place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface-2 disabled:opacity-25"
                  disabled={view <= monthStart(today)}
                  onClick={() => setView(addMonths(view, -1))}
                >
                  <ChevronLeft size={18} />
                </button>
              ) : (
                <span className="size-8" />
              )}
              <div className="display text-[22px]">
                {MONTHS[toDate(m).getUTCMonth()]} <span className="text-ink-3">{toDate(m).getUTCFullYear()}</span>
              </div>
              <button
                type="button"
                aria-label="Следующий месяц"
                className={`grid size-8 place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface-2 ${mi === 0 ? 'sm:invisible' : ''}`}
                onClick={() => setView(addMonths(view, 1))}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="grid grid-cols-7 text-center text-[11px] font-semibold tracking-wider text-ink-3 uppercase">
              {WD.map((w) => (
                <div key={w} className="pb-2">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
              {monthGrid(m).map((d, i) => {
                if (!d) return <div key={`e${i}`} />
                const past = d < today
                const isBusy = busy?.has(d) ?? false
                // День выезда может совпадать с чужим заездом — блокируем только ночь
                const canBeCheckout = !!picking && d > checkIn! && !rangeHasBusy(checkIn!, d)
                const disabled = past || (isBusy && !canBeCheckout)
                const isStart = d === checkIn
                const isEnd = d === rangeEnd
                const inRange = !!(checkIn && rangeEnd && d > checkIn && d < rangeEnd)
                const holiday = holidays?.has(d)
                const price = !past && !isBusy && priceFor ? priceFor(d) : null
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={disabled}
                    onClick={() => click(d)}
                    onMouseEnter={() => setHover(d)}
                    aria-pressed={isStart || isEnd}
                    aria-label={`${d}${isBusy ? ', занято' : ''}${price ? `, ${price} BYN` : ''}`}
                    className={[
                      'relative h-[52px] transition-colors',
                      inRange ? 'bg-accent-soft' : '',
                      isStart && rangeEnd ? 'rounded-l-full bg-accent-soft' : '',
                      isEnd && checkIn ? 'rounded-r-full bg-accent-soft' : '',
                      disabled ? 'cursor-not-allowed' : 'group',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'mx-auto flex size-[50px] flex-col items-center justify-center rounded-full leading-none transition-colors',
                        isStart || isEnd ? 'bg-accent text-accent-ink' : 'group-hover:bg-surface-2',
                        d === today && !isStart && !isEnd ? 'ring-1 ring-line-strong' : '',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'text-[15px] font-semibold tabular-nums',
                          disabled ? 'text-ink-3/50' : '',
                          isBusy && !past ? 'line-through decoration-1' : '',
                          holiday && !disabled && !(isStart || isEnd) ? 'text-brass' : '',
                        ].join(' ')}
                      >
                        {Number(d.slice(8))}
                      </span>
                      {price !== null && (
                        <span className={`mt-1 text-[10px] font-medium tabular-nums ${isStart || isEnd ? 'text-accent-ink/70' : 'text-ink-3'}`}>
                          {price}
                        </span>
                      )}
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
