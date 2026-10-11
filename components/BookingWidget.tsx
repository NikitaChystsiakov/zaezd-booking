'use client'

import { useMemo, useState, useTransition } from 'react'
import { Check, Info, Minus, Plus, Phone, Send, MessageCircle, Users } from 'lucide-react'
import { RangeCalendar } from './RangeCalendar'
import { quote, pickRate, nightPrice, depositFor, formatMoney, type ExtraPick, type QuoteExtra, type QuoteRate, type QuoteUnit } from '@/lib/quote'
import { daysBetween, formatRange, plural, type ISODate } from '@/lib/dates'
import { createLead } from '@/app/u/[slug]/actions'

export type WidgetUnit = QuoteUnit & {
  id: string
  summary: string | null
  photo: string | null
  rates: QuoteRate[]
}

export type WidgetExtra = QuoteExtra & { description: string | null; group: string | null }

type Props = {
  slug: string
  priceMode: 'exact' | 'from' | 'hidden'
  depositPercent: number
  callbackMinutes: number
  today: ISODate
  holidays: ISODate[]
  units: WidgetUnit[]
  extras: WidgetExtra[]
  /** null — занятость гостю не показываем */
  busy: Record<string, ISODate[]> | null
  phone: string | null
  initialUnitId?: string
}

const OCCASIONS = ['Отдых компанией', 'День рождения', 'Отдых вдвоём', 'Семьёй с детьми', 'Корпоратив']

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="inline-flex items-center rounded-full border border-line-strong bg-surface">
      <button type="button" aria-label={`${label}: меньше`} className="grid size-10 place-items-center rounded-full text-ink-2 hover:text-ink disabled:opacity-30" disabled={value <= min} onClick={() => onChange(value - 1)}>
        <Minus size={15} />
      </button>
      <span className="w-8 text-center text-[15px] font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" aria-label={`${label}: больше`} className="grid size-10 place-items-center rounded-full text-ink-2 hover:text-ink disabled:opacity-30" disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Plus size={15} />
      </button>
    </div>
  )
}

function Step({ n, title, hint, children }: { n: number; title: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-8 first:border-t-0 first:pt-0">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="flex items-baseline gap-3">
          <span className="display text-[15px] text-brass italic">{String(n).padStart(2, '0')}</span>
          <span className="display text-[28px]">{title}</span>
        </h3>
        {hint && <div className="text-sm text-ink-2">{hint}</div>}
      </div>
      {children}
    </section>
  )
}

export function BookingWidget({ slug, priceMode, depositPercent, callbackMinutes, today, holidays, units, extras, busy, phone, initialUnitId }: Props) {
  const [unitId, setUnitId] = useState(initialUnitId ?? units[0]?.id ?? '')
  const [checkIn, setCheckIn] = useState<ISODate | null>(null)
  const [checkOut, setCheckOut] = useState<ISODate | null>(null)
  const [guests, setGuests] = useState(8)
  const [children, setChildren] = useState(0)
  const [picks, setPicks] = useState<ExtraPick[]>([])
  const [occasion, setOccasion] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [phoneValue, setPhone] = useState('')
  const [contactVia, setContactVia] = useState<'call' | 'telegram' | 'viber'>('call')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<{ total: number | null } | null>(null)
  const [pending, startTransition] = useTransition()

  const unit = units.find((u) => u.id === unitId) ?? units[0]
  const holidaySet = useMemo(() => new Set(holidays), [holidays])
  const busySet = useMemo(() => (busy ? new Set(busy[unit.id] ?? []) : null), [busy, unit.id])
  const nights = checkIn && checkOut ? daysBetween(checkIn, checkOut) : 0
  const showPrices = priceMode !== 'hidden'

  const q = useMemo(() => {
    if (!checkIn || !checkOut) return null
    return quote({ unit, rates: unit.rates, extras, picks, checkIn, checkOut, guests, holidays, today })
  }, [unit, checkIn, checkOut, guests, picks, extras, holidays, today])

  // Цена ночи в ячейке календаря — для выбранного числа гостей
  const priceFor = useMemo(() => {
    if (!showPrices) return null
    const daysAhead = (d: ISODate) => daysBetween(today, checkIn && !checkOut ? checkIn : d)
    return (d: ISODate) => {
      const { rate } = pickRate(unit.rates, d, { guests, isHoliday: holidaySet.has(d), daysAhead: daysAhead(d) })
      return rate ? nightPrice(rate, guests).total : null
    }
  }, [showPrices, unit.rates, guests, holidaySet, today, checkIn, checkOut])

  const groups = useMemo(() => {
    const map = new Map<string, WidgetExtra[]>()
    for (const e of extras) map.set(e.group ?? 'Ещё', [...(map.get(e.group ?? 'Ещё') ?? []), e])
    return [...map.entries()]
  }, [extras])

  // Ночи с одинаковым тарифом и ценой — одной строкой
  const nightLines = useMemo(() => {
    if (!q) return []
    const lines = new Map<string, { label: string; count: number; total: number }>()
    for (const n of q.nights) {
      const each = n.total + n.discount
      const key = `${n.rate}|${each}`
      const line = lines.get(key) ?? { label: n.rate, count: 0, total: 0 }
      line.count++
      line.total += each
      lines.set(key, line)
    }
    return [...lines.values()]
  }, [q])

  const qtyOf = (id: string) => picks.find((p) => p.id === id)?.qty ?? 0
  function setQty(id: string, qty: number) {
    setPicks((list) => (qty <= 0 ? list.filter((p) => p.id !== id) : list.some((p) => p.id === id) ? list.map((p) => (p.id === id ? { id, qty } : p)) : [...list, { id, qty }]))
  }

  function selectUnit(id: string) {
    setUnitId(id)
    setCheckIn(null)
    setCheckOut(null)
    const u = units.find((x) => x.id === id)
    if (u && guests > u.capacity) setGuests(u.capacity)
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!checkIn || !checkOut) {
      setError('Выберите даты заезда и выезда в календаре')
      document.getElementById('bw-dates')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    const website = String(new FormData(e.currentTarget).get('website') ?? '')
    startTransition(async () => {
      const res = await createLead(slug, { unitId: unit.id, checkIn, checkOut, guests, children, picks, occasion, name, phone: phoneValue, contactVia, comment, website })
      if (res.ok) setSent({ total: res.total })
      else setError(res.error)
    })
  }

  if (sent) {
    return (
      <div className="rounded-[20px] bg-surface px-6 py-14 text-center text-ink sm:px-14">
        <div className="mx-auto mb-6 grid size-14 place-items-center rounded-full bg-ok-soft text-ok">
          <Check size={26} />
        </div>
        <h3 className="display text-4xl">Заявка отправлена</h3>
        <p className="mx-auto mt-4 max-w-md text-ink-2">
          {name.split(' ')[0]}, мы получили заявку: {unit.name.replace('Дом ', 'дом ')}, {checkIn && checkOut && formatRange(checkIn, checkOut)}.{' '}
          {contactVia === 'call' ? 'Перезвоним' : `Напишем в ${contactVia === 'telegram' ? 'Telegram' : 'Viber'}`} в течение{' '}
          {callbackMinutes >= 60 ? `${callbackMinutes / 60} ч` : `${callbackMinutes} минут`}, подтвердим даты и расскажем, как внести задаток.
        </p>
        {sent.total !== null && showPrices && (
          <p className="mt-4 text-sm text-ink-3">
            Расчёт: {formatMoney(sent.total)}, задаток {depositPercent}% — {formatMoney(depositFor(sent.total, depositPercent))}
          </p>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="rounded-[20px] bg-surface p-5 text-ink sm:p-9">
        <Step n={1} title="Дом">
          <div className="grid gap-3 sm:grid-cols-2">
            {units.map((u) => {
              const on = u.id === unit.id
              return (
                <button
                  type="button"
                  key={u.id}
                  onClick={() => selectUnit(u.id)}
                  aria-pressed={on}
                  className={`group flex gap-4 rounded-2xl border p-2.5 pr-4 text-left transition-colors ${on ? 'border-accent bg-accent-soft/60' : 'border-line hover:border-line-strong'}`}
                >
                  {u.photo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.photo} alt="" className="photo-grade size-[76px] shrink-0 rounded-xl object-cover" />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col justify-center">
                    <span className="flex items-center justify-between gap-2">
                      <span className="display text-[24px]">{u.name}</span>
                      <span className={`grid size-5 shrink-0 place-items-center rounded-full border ${on ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong'}`}>
                        {on && <Check size={12} strokeWidth={3} />}
                      </span>
                    </span>
                    <span className="mt-0.5 text-[13px] leading-snug text-ink-2">{u.summary}</span>
                    <span className="mt-1 text-xs font-semibold text-ink-3">до {u.capacity} гостей</span>
                  </span>
                </button>
              )
            })}
          </div>
        </Step>

        <Step n={2} title="Гости" hint={showPrices ? 'цены в календаре — на это количество' : undefined}>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <div className="flex items-center gap-3">
              <Stepper label="Гостей" value={guests} min={1} max={unit.capacity} onChange={(v) => { setGuests(v); if (children > v) setChildren(v) }} />
              <span className="text-[15px]">{plural(guests, 'гость', 'гостя', 'гостей')} всего</span>
            </div>
            <div className="flex items-center gap-3">
              <Stepper label="Из них детей" value={children} min={0} max={guests} onChange={setChildren} />
              <span className="text-[15px]">из них дети</span>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {OCCASIONS.map((o) => (
              <button
                type="button"
                key={o}
                onClick={() => setOccasion(occasion === o ? null : o)}
                aria-pressed={occasion === o}
                className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${occasion === o ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong text-ink-2 hover:border-ink hover:text-ink'}`}
              >
                {o}
              </button>
            ))}
          </div>
        </Step>

        <div id="bw-dates" className="scroll-mt-24">
          <Step
            n={3}
            title="Даты"
            hint={
              checkIn && checkOut ? (
                <span className="font-semibold text-ink">
                  {formatRange(checkIn, checkOut)} · {nights} {plural(nights, 'ночь', 'ночи', 'ночей')}
                </span>
              ) : checkIn ? (
                'теперь — день выезда'
              ) : (
                'выберите заезд и выезд'
              )
            }
          >
            <RangeCalendar
              today={today}
              checkIn={checkIn}
              checkOut={checkOut}
              busy={busySet}
              holidays={holidaySet}
              priceFor={priceFor}
              onChange={(a, b) => {
                setCheckIn(a)
                setCheckOut(b)
              }}
            />
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-3">
              {busy ? <span><span className="line-through">12</span> — занято</span> : <span>Свободные даты подтвердит администратор</span>}
              <span>
                <span className="font-semibold text-brass">12</span> — праздник
              </span>
              {showPrices && <span>цифра под датой — цена ночи, BYN</span>}
            </div>
          </Step>
        </div>

        <Step n={4} title="К отдыху" hint="можно добавить и позже, при звонке">
          <div className="space-y-6">
            {groups.map(([group, items]) => (
              <div key={group}>
                <div className="eyebrow mb-2 text-ink-3">{group}</div>
                <ul className="divide-y divide-line rounded-2xl border border-line">
                  {items.map((e) => {
                    const qty = qtyOf(e.id)
                    const auto = e.priceType === 'per_person' || e.priceType === 'per_night'
                    return (
                      <li key={e.id} className="flex items-center gap-4 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-[15px] font-semibold">{e.name}</div>
                          {e.description && <div className="text-[13px] leading-snug text-ink-3">{e.description}</div>}
                        </div>
                        {showPrices && (
                          <div className="text-right text-[13px] whitespace-nowrap text-ink-2">
                            <span className="font-semibold text-ink tabular-nums">{e.price}</span> BYN
                            {e.unitLabel && e.maxQty > 1 && <span className="text-ink-3"> / {e.unitLabel}</span>}
                          </div>
                        )}
                        {e.maxQty > 1 && !auto ? (
                          qty > 0 ? (
                            <Stepper label={e.name} value={qty} min={0} max={e.maxQty} onChange={(v) => setQty(e.id, v)} />
                          ) : (
                            <button type="button" onClick={() => setQty(e.id, 1)} className="grid size-10 shrink-0 place-items-center rounded-full border border-line-strong text-ink-2 hover:border-ink hover:text-ink" aria-label={`Добавить: ${e.name}`}>
                              <Plus size={16} />
                            </button>
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={() => setQty(e.id, qty ? 0 : 1)}
                            aria-pressed={qty > 0}
                            aria-label={`${qty ? 'Убрать' : 'Добавить'}: ${e.name}`}
                            className={`grid size-10 shrink-0 place-items-center rounded-full border transition-colors ${qty ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong text-ink-2 hover:border-ink hover:text-ink'}`}
                          >
                            {qty ? <Check size={16} /> : <Plus size={16} />}
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </Step>
      </div>

      <aside className="lg:sticky lg:top-6">
        <div className="overflow-hidden rounded-[20px] bg-surface text-ink">
          {unit.photo && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={unit.photo} alt="" className="photo-grade aspect-[16/9] w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-5 pt-10 pb-3 text-[#f3ece0]">
                <div className="display text-[28px]">{unit.name}</div>
              </div>
            </div>
          )}
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
              <span>{checkIn && checkOut ? `${formatRange(checkIn, checkOut)}, ${nights} ${plural(nights, 'ночь', 'ночи', 'ночей')}` : 'Даты не выбраны'}</span>
              <span className="flex items-center gap-1">
                <Users size={14} /> {guests}
                {children > 0 && `, из них ${children} ${plural(children, 'ребёнок', 'ребёнка', 'детей')}`}
              </span>
            </div>

            {showPrices && q && (
              <div className="mt-5">
                {!q.ok ? (
                  <p className="text-sm text-alert">{q.errors[0]}</p>
                ) : priceMode === 'from' ? (
                  <div>
                    <div className="text-sm text-ink-2">Ориентировочно</div>
                    <div className="mt-1 text-[30px] font-semibold tracking-tight tabular-nums">{formatMoney(Math.round(q.total / 10) * 10)}</div>
                  </div>
                ) : (
                  <>
                    <dl className="space-y-2 text-sm">
                      {nightLines.map((l, i) => (
                        <div key={i} className="flex justify-between gap-4">
                          <dt className="text-ink-2">
                            {l.label}
                            {l.count > 1 && ` × ${l.count}`}
                          </dt>
                          <dd className="tabular-nums">{formatMoney(l.total)}</dd>
                        </div>
                      ))}
                      {q.discount > 0 && (
                        <div className="flex justify-between gap-4 text-ok">
                          <dt>Скидка за долгое проживание</dt>
                          <dd className="tabular-nums">−{formatMoney(q.discount)}</dd>
                        </div>
                      )}
                      {q.extras.map((l) => (
                        <div key={l.id} className="flex justify-between gap-4">
                          <dt className="text-ink-2">
                            {l.name}
                            {l.qty > 1 && ` × ${l.qty}`}
                          </dt>
                          <dd className="tabular-nums">{formatMoney(l.total)}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
                      <span className="font-semibold">Итого</span>
                      <span className="text-[28px] font-semibold tracking-tight tabular-nums">{formatMoney(q.total)}</span>
                    </div>
                    <div className="mt-1 flex justify-between text-sm text-ink-2">
                      <span>Задаток для брони, {depositPercent}%</span>
                      <span className="tabular-nums">{formatMoney(depositFor(q.total, depositPercent))}</span>
                    </div>
                  </>
                )}
                {q.notes.map((n) => (
                  <p key={n} className="mt-3 flex gap-2 rounded-xl bg-brass-soft px-3 py-2.5 text-[13px] leading-snug text-ink-2">
                    <Info size={15} className="mt-0.5 shrink-0 text-brass" /> {n}
                  </p>
                ))}
              </div>
            )}

            <div className="mt-6 space-y-3 border-t border-line pt-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div>
                  <label className="label" htmlFor="bw-name">Имя</label>
                  <input id="bw-name" className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" required />
                </div>
                <div>
                  <label className="label" htmlFor="bw-phone">Телефон</label>
                  <input id="bw-phone" className="field" value={phoneValue} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" placeholder="+375 29 …" autoComplete="tel" required />
                </div>
              </div>
              <div>
                <span className="label">Как с вами связаться</span>
                <div className="grid grid-cols-3 gap-1 rounded-full bg-surface-2 p-1">
                  {([
                    ['call', 'Звонок', Phone],
                    ['telegram', 'Telegram', Send],
                    ['viber', 'Viber', MessageCircle],
                  ] as const).map(([v, label, Icon]) => (
                    <button
                      type="button"
                      key={v}
                      onClick={() => setContactVia(v)}
                      aria-pressed={contactVia === v}
                      className={`flex h-9 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold transition-colors ${contactVia === v ? 'bg-surface text-ink shadow-sm' : 'text-ink-2 hover:text-ink'}`}
                    >
                      <Icon size={13} /> {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label" htmlFor="bw-comment">Вопросы и пожелания</label>
                <textarea id="bw-comment" className="field h-auto min-h-20 py-2.5" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Например: будем с собакой, нужна детская кроватка" />
              </div>
              <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
            </div>

            {error && <p className="mt-4 text-sm text-alert" role="alert">{error}</p>}
            <button className="btn-primary mt-5 h-[52px] w-full text-[15px]" disabled={pending}>
              {pending ? 'Отправляем…' : 'Отправить заявку'}
            </button>
            <p className="mt-3 text-center text-xs leading-relaxed text-ink-3">
              Это ещё не оплата. Администратор подтвердит даты и расскажет, как внести задаток.
              {phone && (
                <>
                  {' '}
                  Удобнее голосом —{' '}
                  <a className="whitespace-nowrap underline underline-offset-2" href={`tel:${phone.replace(/[^\d+]/g, '')}`}>
                    {phone}
                  </a>
                </>
              )}
            </p>
          </div>
        </div>
      </aside>
    </form>
  )
}
