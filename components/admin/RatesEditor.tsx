'use client'

import { useState, useTransition } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { deleteRate, saveRate, type RateInput } from '@/app/admin/actions'
import { WEEK_ORDER, WEEKDAYS_SHORT, weekdaysLabel } from '@/lib/domain'
import { formatMoney } from '@/lib/quote'
import { Section } from './ui'

export type RateRow = RateInput & { id: string }

const PRIORITY = [
  { v: 0, label: 'Обычный' },
  { v: 10, label: 'Важнее обычных — праздники, сезон' },
  { v: 100, label: 'Особый — Новый год и т.п.' },
]

function when(r: RateInput): string {
  const parts = [r.holidaysOnly ? 'праздничные дни' : weekdaysLabel(r.weekdays)]
  if (r.startDate || r.endDate) parts.push(`${r.startDate ?? '…'} — ${r.endDate ?? '…'}`)
  return parts.join(' · ')
}

function guestsLabel(r: RateInput): string {
  if (r.maxGuests === null) return r.minGuests > 1 ? `от ${r.minGuests} гостей` : 'любая компания'
  return `${r.minGuests}–${r.maxGuests} гостей`
}

export function RatesEditor({ unitId, capacity, rates, canDelete }: { unitId: string; capacity: number; rates: RateRow[]; canDelete: boolean }) {
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const blank: RateInput = {
    name: '', weekdays: [], holidaysOnly: false, startDate: null, endDate: null, minGuests: 1, maxGuests: null,
    includedGuests: capacity, pricePerNight: 0, extraGuestPrice: 0, bookableWithinDays: null, priority: 0,
  }

  return (
    <Section
      title="Тарифы"
      sub="Цена ночи. Для каждой ночи берутся подходящие тарифы с самым высоким приоритетом, из них — самый выгодный для гостя. Так «небольшая компания в будни» сама оказывается дешевле «всего дома»."
      aside={
        editing !== 'new' && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing('new')}>
            <Plus size={15} /> Тариф
          </button>
        )
      }
    >
      <div className="overflow-hidden rounded-2xl border border-line">
        <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_40px] gap-4 bg-surface-2 px-5 py-2.5 text-xs font-semibold text-ink-3 md:grid">
          <span>Тариф</span>
          <span>Когда</span>
          <span>Для кого</span>
          <span className="text-right">Цена ночи</span>
          <span />
        </div>
        <ul className="divide-y divide-line">
          {editing === 'new' && (
            <li className="bg-surface-2/50 p-5">
              <RateForm unitId={unitId} rateId={null} initial={blank} capacity={capacity} canDelete={canDelete} onDone={() => setEditing(null)} />
            </li>
          )}
          {rates.map((r) =>
            editing === r.id ? (
              <li key={r.id} className="bg-surface-2/50 p-5">
                <RateForm unitId={unitId} rateId={r.id} initial={r} capacity={capacity} canDelete={canDelete} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <li key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_40px]">
                <div className="min-w-0">
                  <div className="font-semibold">{r.name}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1.5">
                    {r.priority > 0 && <span className="chip bg-brass-soft text-brass">приоритет</span>}
                    {r.bookableWithinDays && <span className="chip bg-info-soft text-info">за {r.bookableWithinDays} дн. до заезда</span>}
                  </div>
                </div>
                <div className="order-3 text-sm text-ink-2 md:order-none">{when(r)}</div>
                <div className="order-4 text-sm text-ink-2 md:order-none">
                  {guestsLabel(r)}
                  <span className="block text-xs text-ink-3">в цене {r.includedGuests} гост.</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold tabular-nums">{formatMoney(r.pricePerNight)}</div>
                  {r.extraGuestPrice > 0 && <div className="text-xs text-ink-3">+{r.extraGuestPrice} за гостя</div>}
                </div>
                <button type="button" className="hidden size-8 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink md:grid" aria-label={`Изменить «${r.name}»`} onClick={() => setEditing(r.id)}>
                  <Pencil size={15} />
                </button>
                <button type="button" className="btn-quiet btn-sm order-5 col-span-2 justify-self-start px-0 md:hidden" onClick={() => setEditing(r.id)}>
                  Изменить
                </button>
              </li>
            ),
          )}
        </ul>
      </div>
    </Section>
  )
}

function RateForm({ unitId, rateId, initial, capacity, canDelete, onDone }: { unitId: string; rateId: string | null; initial: RateInput; capacity: number; canDelete: boolean; onDone: () => void }) {
  const [r, setR] = useState<RateInput>(initial)
  const [period, setPeriod] = useState(!!(initial.startDate || initial.endDate))
  const [error, setError] = useState<string | null>(null)
  const [pending, run] = useTransition()
  const set = <K extends keyof RateInput>(k: K, v: RateInput[K]) => setR((p) => ({ ...p, [k]: v }))
  const num = (v: string) => (v === '' ? null : Number(v))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        run(async () => {
          setError(null)
          const res = await saveRate(unitId, rateId, period ? r : { ...r, startDate: null, endDate: null })
          if (res.ok) onDone()
          else setError(res.error)
        })
      }}
      className="space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <div>
          <label className="label" htmlFor="rf-name">Название тарифа</label>
          <input id="rf-name" className="field" value={r.name} onChange={(e) => set('name', e.target.value)} placeholder="Например: Выходные" autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="rf-prio">Приоритет</label>
          <select id="rf-prio" className="field" value={r.priority} onChange={(e) => set('priority', Number(e.target.value))}>
            {PRIORITY.map((p) => (
              <option key={p.v} value={p.v}>{p.label}</option>
            ))}
            {!PRIORITY.some((p) => p.v === r.priority) && <option value={r.priority}>{r.priority}</option>}
          </select>
        </div>
      </div>

      <div>
        <span className="label">Когда действует</span>
        <div className="flex flex-wrap items-center gap-2">
          {WEEK_ORDER.map((d) => {
            const on = r.weekdays.includes(d)
            return (
              <button
                type="button"
                key={d}
                disabled={r.holidaysOnly}
                aria-pressed={on}
                onClick={() => set('weekdays', on ? r.weekdays.filter((x) => x !== d) : [...r.weekdays, d])}
                className={`size-10 rounded-full text-sm font-semibold uppercase transition-colors disabled:opacity-30 ${on ? 'bg-accent text-accent-ink' : 'border border-line-strong text-ink-2 hover:border-ink'}`}
              >
                {WEEKDAYS_SHORT[d]}
              </button>
            )
          })}
          <span className="mx-1 text-ink-3">или</span>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={r.holidaysOnly} onChange={(e) => set('holidaysOnly', e.target.checked)} />
            только праздничные дни
          </label>
        </div>
        <p className="mt-2 text-xs text-ink-3">{r.holidaysOnly ? 'Даты праздников — в разделе «Тексты и фото».' : r.weekdays.length ? weekdaysLabel(r.weekdays) : 'Ни один день не отмечен — тариф действует в любой день.'}</p>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={period} onChange={(e) => setPeriod(e.target.checked)} />
          только в период
        </label>
        {period && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <input type="date" className="field w-auto" value={r.startDate ?? ''} onChange={(e) => set('startDate', e.target.value || null)} aria-label="Начало периода" />
            —
            <input type="date" className="field w-auto" value={r.endDate ?? ''} onChange={(e) => set('endDate', e.target.value || null)} aria-label="Конец периода" />
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="label" htmlFor="rf-price">Цена ночи, BYN</label>
          <input id="rf-price" className="field tabular-nums" type="number" min={0} value={r.pricePerNight} onChange={(e) => set('pricePerNight', Number(e.target.value))} />
        </div>
        <div>
          <label className="label" htmlFor="rf-inc">Гостей в цене</label>
          <input id="rf-inc" className="field tabular-nums" type="number" min={1} max={capacity} value={r.includedGuests} onChange={(e) => set('includedGuests', Number(e.target.value))} />
        </div>
        <div>
          <label className="label" htmlFor="rf-extra">За гостя сверх</label>
          <input id="rf-extra" className="field tabular-nums" type="number" min={0} value={r.extraGuestPrice} onChange={(e) => set('extraGuestPrice', Number(e.target.value))} />
        </div>
        <div>
          <label className="label" htmlFor="rf-max">Компания до, чел.</label>
          <input id="rf-max" className="field tabular-nums" type="number" min={1} placeholder="любая" value={r.maxGuests ?? ''} onChange={(e) => set('maxGuests', num(e.target.value))} />
        </div>
        <div>
          <label className="label" htmlFor="rf-win">Открыт за, дней</label>
          <input id="rf-win" className="field tabular-nums" type="number" min={1} placeholder="всегда" value={r.bookableWithinDays ?? ''} onChange={(e) => set('bookableWithinDays', num(e.target.value))} />
        </div>
      </div>
      <p className="text-xs leading-relaxed text-ink-3">
        «Открыт за N дней» — тариф доступен, только если до заезда осталось не больше N дней. Например, «небольшие компании — не раньше чем за две недели»: раньше гость увидит цену всего дома и пояснение.
      </p>

      {error && <p className="text-sm text-alert">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" disabled={pending}>{pending ? 'Сохраняем…' : 'Сохранить тариф'}</button>
        <button type="button" className="btn-quiet" onClick={onDone}>Отмена</button>
        {rateId && canDelete && (
          <button
            type="button"
            className="btn-quiet ml-auto text-alert"
            disabled={pending}
            onClick={() =>
              confirm(`Удалить тариф «${initial.name}»?`) &&
              run(async () => {
                const res = await deleteRate(unitId, rateId)
                if (res.ok) onDone()
                else setError(res.error)
              })
            }
          >
            <Trash2 size={15} /> Удалить
          </button>
        )}
      </div>
    </form>
  )
}
