'use client'

import { useMemo, useState } from 'react'
import { quote, formatMoney, type QuoteExtra, type QuoteRate, type QuoteUnit } from '@/lib/quote'
import { addDays, formatDay, weekdayShort } from '@/lib/dates'
import { Section } from './ui'

// Владелец проверяет тарифы так же, как их увидит гость: даты, гости — и какой тариф сработал в каждую ночь
export function PriceCheck({ unit, rates, extras, holidays, today }: { unit: QuoteUnit; rates: QuoteRate[]; extras: QuoteExtra[]; holidays: string[]; today: string }) {
  const [checkIn, setCheckIn] = useState(addDays(today, 7))
  const [nights, setNights] = useState(2)
  const [guests, setGuests] = useState(Math.min(8, unit.capacity))
  const checkOut = addDays(checkIn, Math.max(1, nights))

  const q = useMemo(
    () => quote({ unit, rates, extras, picks: [], checkIn, checkOut, guests, holidays, today }),
    [unit, rates, extras, checkIn, checkOut, guests, holidays, today],
  )

  return (
    <Section title="Проверить расчёт" sub="Посчитайте любой заезд — так же его посчитает сайт. Удобно после правки тарифов.">
      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="pc-in">Заезд</label>
            <input id="pc-in" type="date" className="field" value={checkIn} onChange={(e) => e.target.value && setCheckIn(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="pc-n">Ночей</label>
              <input id="pc-n" type="number" min={1} max={30} className="field tabular-nums" value={nights} onChange={(e) => setNights(Math.max(1, Number(e.target.value)))} />
            </div>
            <div>
              <label className="label" htmlFor="pc-g">Гостей</label>
              <input id="pc-g" type="number" min={1} className="field tabular-nums" value={guests} onChange={(e) => setGuests(Math.max(1, Number(e.target.value)))} />
            </div>
          </div>
          <p className="text-xs text-ink-3">Окно бронирования считается от сегодняшнего дня.</p>
        </div>

        <div>
          {q.errors.length > 0 && <p className="mb-3 text-sm text-alert">{q.errors.join('. ')}</p>}
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {q.nights.map((n) => (
                <tr key={n.date}>
                  <td className="py-2.5 pr-3 whitespace-nowrap">
                    <span className="font-semibold">{formatDay(n.date)}</span> <span className="text-ink-3">{weekdayShort(n.date)}</span>
                    {n.holiday && <span className="chip ml-2 bg-brass-soft text-brass">праздник</span>}
                  </td>
                  <td className="py-2.5 pr-3 text-ink-2">
                    {n.rate}
                    {n.extraGuests > 0 && <span className="text-ink-3"> · +{n.extraGuests} гост. × {n.extraGuestsCost / n.extraGuests}</span>}
                    {n.discount > 0 && <span className="text-ok"> · скидка −{n.discount}</span>}
                  </td>
                  <td className="py-2.5 text-right font-semibold tabular-nums">{formatMoney(n.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
            <span className="font-bold">За {nights} {nights === 1 ? 'ночь' : nights < 5 ? 'ночи' : 'ночей'}</span>
            <span className="text-[26px] font-semibold tracking-tight tabular-nums">{formatMoney(q.lodging)}</span>
          </div>
          {q.notes.map((n) => (
            <p key={n} className="mt-3 rounded-xl bg-info-soft px-3 py-2 text-[13px] text-info">{n}</p>
          ))}
        </div>
      </div>
    </Section>
  )
}
