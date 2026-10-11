'use client'

import { useMemo, useState, useTransition } from 'react'
import { Check, Minus, Plus, Phone, Send, MessageCircle, Sparkles } from 'lucide-react'
import { RangeCalendar } from './RangeCalendar'
import { quote, formatMoney, type QuoteExtra, type QuoteRate } from '@/lib/quote'
import { daysBetween, formatRange, plural, type ISODate } from '@/lib/dates'
import { OCCASIONS, PRICE_TYPE_LABEL } from '@/lib/domain'
import { createLead } from '@/app/u/[slug]/actions'

export type WidgetUnit = {
  id: string
  name: string
  kind: 'house' | 'room' | 'venue' | 'whole'
  capacity: number
  baseGuests: number
  rates: QuoteRate[]
}

type Props = {
  slug: string
  propertyName: string
  priceMode: 'exact' | 'from' | 'hidden'
  callbackMinutes: number
  today: ISODate
  units: WidgetUnit[]
  extras: (QuoteExtra & { description: string | null })[]
  /** null — занятость не показываем */
  busy: Record<string, ISODate[]> | null
}

export function BookingWidget({ slug, propertyName, priceMode, callbackMinutes, today, units, extras, busy }: Props) {
  const [unitId, setUnitId] = useState<string | null>(units[0]?.id ?? null)
  const [checkIn, setCheckIn] = useState<ISODate | null>(null)
  const [checkOut, setCheckOut] = useState<ISODate | null>(null)
  const [guests, setGuests] = useState(8)
  const [extraIds, setExtraIds] = useState<string[]>([])
  const [occasion, setOccasion] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [contactVia, setContactVia] = useState<'call' | 'telegram' | 'viber'>('call')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [pending, startTransition] = useTransition()

  const unit = units.find((u) => u.id === unitId) ?? null
  const busySet = useMemo(() => (busy && unitId ? new Set(busy[unitId] ?? []) : null), [busy, unitId])
  const nights = checkIn && checkOut ? daysBetween(checkIn, checkOut) : 0

  const q = useMemo(() => {
    if (!unit || !checkIn || !checkOut) return null
    return quote({ unit, rates: unit.rates, extras, checkIn, checkOut, guests, extraIds })
  }, [unit, checkIn, checkOut, guests, extraIds, extras])

  const maxGuests = unit?.capacity ?? Math.max(...units.map((u) => u.capacity))

  function selectUnit(id: string | null) {
    setUnitId(id)
    setCheckIn(null)
    setCheckOut(null)
    const u = units.find((x) => x.id === id)
    if (u && guests > u.capacity) setGuests(u.capacity)
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!checkIn || !checkOut) return setError('Выберите даты в календаре')
    const website = String(new FormData(e.currentTarget).get('website') ?? '')
    startTransition(async () => {
      const res = await createLead(slug, {
        unitId, checkIn, checkOut, guests, extraIds, occasion, name, phone, contactVia, comment, website,
      })
      if (res.ok) setSent(true)
      else setError(res.error)
    })
  }

  if (sent) {
    return (
      <div className="card px-6 py-12 text-center sm:px-12">
        <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-ok-soft text-ok">
          <Check size={28} />
        </div>
        <h3 className="font-serif text-2xl">Заявка у администратора</h3>
        <p className="mx-auto mt-3 max-w-md text-ink-2">
          {name.split(' ')[0]}, мы получили заявку на {checkIn && checkOut && formatRange(checkIn, checkOut)}.{' '}
          {contactVia === 'call' ? 'Перезвоним' : `Напишем в ${contactVia === 'telegram' ? 'Telegram' : 'Viber'}`} в течение{' '}
          {callbackMinutes >= 60 ? `${callbackMinutes / 60} ч` : `${callbackMinutes} минут`}, ответим на вопросы и пришлём
          точное предложение.
        </p>
        <button className="btn-ghost mt-8" onClick={() => location.reload()}>
          Отправить ещё одну
        </button>
      </div>
    )
  }

  const priceBlock = () => {
    if (priceMode === 'hidden') {
      return <p className="text-sm text-ink-2">Стоимость администратор назовёт по телефону — она зависит от состава компании и услуг.</p>
    }
    if (!unit) return <p className="text-sm text-ink-2">Подберём объект под вашу компанию и назовём цену при звонке.</p>
    if (!q) return <p className="text-sm text-ink-2">Выберите даты — посчитаем стоимость.</p>
    if (!q.ok) return <p className="text-sm text-accent">{q.errors[0]}</p>
    if (priceMode === 'from') {
      return (
        <div>
          <div className="text-sm text-ink-2">Ориентировочно</div>
          <div className="text-3xl font-semibold tabular-nums">{formatMoney(Math.round(q.total / 10) * 10)}</div>
          <p className="mt-1 text-xs text-ink-3">Точную сумму администратор подтвердит при звонке</p>
        </div>
      )
    }
    return (
      <div>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-2">
              {unit.kind === 'venue' ? 'Аренда' : 'Проживание'}, {nights} {unit.kind === 'venue' ? plural(nights, 'день', 'дня', 'дней') : plural(nights, 'ночь', 'ночи', 'ночей')}
            </dt>
            <dd className="tabular-nums">{formatMoney(q.lodging)}</dd>
          </div>
          {q.extras.map((l) => (
            <div key={l.id} className="flex justify-between gap-4">
              <dt className="text-ink-2">
                {l.name}
                {l.qty > 1 ? ` × ${l.qty}` : ''}
              </dt>
              <dd className="tabular-nums">{formatMoney(l.total)}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
          <span className="font-medium">Итого</span>
          <span className="text-2xl font-semibold tabular-nums">{formatMoney(q.total)}</span>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <section className="card p-5 sm:p-6">
          <h3 className="mb-4 font-semibold">1. Что бронируем</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {units.map((u) => (
              <button
                type="button"
                key={u.id}
                onClick={() => selectUnit(u.id)}
                aria-pressed={unitId === u.id}
                className={`rounded-lg border px-4 py-3 text-left transition-colors ${unitId === u.id ? 'border-ink bg-surface-2' : 'border-line hover:border-line-strong'}`}
              >
                <div className="font-medium">{u.name}</div>
                <div className="text-xs text-ink-3">до {u.capacity} гостей{u.kind === 'venue' ? ' · на день' : ''}</div>
              </button>
            ))}
            <button
              type="button"
              onClick={() => selectUnit(null)}
              aria-pressed={unitId === null}
              className={`rounded-lg border border-dashed px-4 py-3 text-left transition-colors sm:col-span-2 ${unitId === null ? 'border-ink bg-surface-2' : 'border-line-strong hover:border-ink'}`}
            >
              <div className="flex items-center gap-2 font-medium">
                <Sparkles size={15} /> Не знаю, подберите мне
              </div>
              <div className="text-xs text-ink-3">Расскажите о компании — администратор предложит лучший вариант</div>
            </button>
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold">2. Когда</h3>
            <span className="text-sm text-ink-2">
              {checkIn && checkOut
                ? `${formatRange(checkIn, checkOut)} · ${nights} ${unit?.kind === 'venue' ? plural(nights, 'день', 'дня', 'дней') : plural(nights, 'ночь', 'ночи', 'ночей')}`
                : checkIn
                  ? 'Теперь выберите дату выезда'
                  : unit?.kind === 'venue'
                    ? 'Выберите день'
                    : 'Выберите заезд и выезд'}
            </span>
          </div>
          <RangeCalendar
            today={today}
            checkIn={checkIn}
            checkOut={checkOut}
            busy={busySet}
            singleDay={unit?.kind === 'venue'}
            onChange={(a, b) => {
              setCheckIn(a)
              setCheckOut(b)
            }}
          />
          {!busy && (
            <p className="mt-3 text-xs text-ink-3">Свободные даты администратор подтвердит при звонке.</p>
          )}
        </section>

        <section className="card p-5 sm:p-6">
          <h3 className="mb-4 font-semibold">3. Компания и повод</h3>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center rounded-lg border border-line-strong">
              <button type="button" aria-label="Меньше гостей" className="grid size-10 place-items-center text-ink-2 hover:text-ink disabled:opacity-30" disabled={guests <= 1} onClick={() => setGuests(guests - 1)}>
                <Minus size={16} />
              </button>
              <span className="w-24 text-center text-sm tabular-nums">
                {guests} {plural(guests, 'гость', 'гостя', 'гостей')}
              </span>
              <button type="button" aria-label="Больше гостей" className="grid size-10 place-items-center text-ink-2 hover:text-ink disabled:opacity-30" disabled={guests >= maxGuests} onClick={() => setGuests(guests + 1)}>
                <Plus size={16} />
              </button>
            </div>
            {unit && unit.kind !== 'venue' && guests > unit.baseGuests && (
              <span className="text-xs text-ink-3">Сверх {unit.baseGuests} — доплата за гостя</span>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {OCCASIONS.map((o) => (
              <button
                type="button"
                key={o}
                onClick={() => setOccasion(occasion === o ? null : o)}
                aria-pressed={occasion === o}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${occasion === o ? 'border-ink bg-ink text-paper' : 'border-line-strong hover:border-ink'}`}
              >
                {o}
              </button>
            ))}
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <h3 className="mb-4 font-semibold">4. Что добавить</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {extras.map((e) => {
              const on = extraIds.includes(e.id)
              return (
                <label key={e.id} className={`flex cursor-pointer gap-3 rounded-lg border px-4 py-3 transition-colors ${on ? 'border-ink bg-surface-2' : 'border-line hover:border-line-strong'}`}>
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-[var(--accent)]"
                    checked={on}
                    onChange={() => setExtraIds(on ? extraIds.filter((x) => x !== e.id) : [...extraIds, e.id])}
                  />
                  <span className="flex-1">
                    <span className="flex justify-between gap-2 text-sm font-medium">
                      {e.name}
                      {priceMode !== 'hidden' && (
                        <span className="whitespace-nowrap font-normal text-ink-2">
                          {e.price} BYN <span className="text-ink-3">{PRICE_TYPE_LABEL[e.priceType]}</span>
                        </span>
                      )}
                    </span>
                    {e.description && <span className="text-xs text-ink-3">{e.description}</span>}
                  </span>
                </label>
              )
            })}
          </div>
        </section>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="card p-5 sm:p-6">
          <h3 className="mb-4 font-semibold">5. Куда ответить</h3>
          <div className="mb-5 rounded-lg bg-surface-2 p-4">{priceBlock()}</div>
          <div className="space-y-3">
            <div>
              <label className="label" htmlFor="bw-name">Имя</label>
              <input id="bw-name" className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" required />
            </div>
            <div>
              <label className="label" htmlFor="bw-phone">Телефон</label>
              <input id="bw-phone" className="field" value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" placeholder="+375 29 ..." autoComplete="tel" required />
            </div>
            <div>
              <span className="label">Как удобнее связаться</span>
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-surface-2 p-1">
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
                    className={`flex h-9 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors ${contactVia === v ? 'bg-surface text-ink shadow-sm' : 'text-ink-2 hover:text-ink'}`}
                  >
                    <Icon size={13} /> {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label" htmlFor="bw-comment">Вопросы и пожелания</label>
              <textarea id="bw-comment" className="field h-auto min-h-20 py-2" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Можно ли с собакой? Нужна ли своя посуда?" />
            </div>
            <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
          </div>
          {error && <p className="mt-3 text-sm text-accent" role="alert">{error}</p>}
          <button className="btn-primary mt-5 h-12 w-full text-base" disabled={pending}>
            {pending ? 'Отправляем…' : 'Отправить заявку'}
          </button>
          <p className="mt-3 text-center text-xs text-ink-3">
            Это не оплата. Администратор «{propertyName}» свяжется с вами и всё подтвердит.
          </p>
        </div>
      </aside>
    </form>
  )
}
