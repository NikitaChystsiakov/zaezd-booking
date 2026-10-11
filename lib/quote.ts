// Расчёт стоимости заезда. Чистая функция без обращений к БД:
// её используют форма заявки, карточка администратора, КП и (в будущем) ИИ-консьерж.

import { eachDay, toISO, weekday, type ISODate } from './dates'

export type QuoteUnit = {
  name: string
  kind: 'house' | 'room' | 'venue' | 'whole'
  capacity: number
  baseGuests: number
}

export type QuoteRate = {
  name: string
  startDate: Date | ISODate | null
  endDate: Date | ISODate | null
  weekdays: number[]
  pricePerNight: number
  extraGuestPrice: number
  priority: number
}

export type QuoteExtra = {
  id: string
  name: string
  priceType: 'per_stay' | 'per_night' | 'per_person' | 'per_hour'
  price: number
}

export type QuoteInput = {
  unit: QuoteUnit
  rates: QuoteRate[]
  extras: QuoteExtra[]
  checkIn: ISODate
  checkOut: ISODate
  guests: number
  extraIds: string[]
}

export type QuoteNight = {
  date: ISODate
  rate: string
  base: number
  extraGuests: number
  extraGuestsCost: number
  total: number
}

export type QuoteExtraLine = { id: string; name: string; qty: number; unitPrice: number; total: number }

export type Quote = {
  ok: boolean
  errors: string[]
  nights: QuoteNight[]
  lodging: number
  extras: QuoteExtraLine[]
  extrasTotal: number
  total: number
}

const iso = (d: Date | ISODate | null) => (d === null ? null : typeof d === 'string' ? d : toISO(d))

export function pickRate(rates: QuoteRate[], date: ISODate): QuoteRate | null {
  const dow = weekday(date)
  let best: QuoteRate | null = null
  for (const r of rates) {
    const start = iso(r.startDate)
    const end = iso(r.endDate)
    if (start && date < start) continue
    if (end && date > end) continue
    if (r.weekdays.length > 0 && !r.weekdays.includes(dow)) continue
    if (!best || r.priority > best.priority) best = r
  }
  return best
}

export function quote(input: QuoteInput): Quote {
  const { unit, rates, extras, checkIn, checkOut, guests, extraIds } = input
  const errors: string[] = []

  if (!(checkIn < checkOut)) errors.push('Дата выезда должна быть позже даты заезда')
  if (guests < 1) errors.push('Укажите количество гостей')
  if (guests > unit.capacity) errors.push(`${unit.name} вмещает до ${unit.capacity} гостей`)

  const days = checkIn < checkOut ? eachDay(checkIn, checkOut) : []
  const extraGuests = Math.max(0, guests - unit.baseGuests)

  const nights: QuoteNight[] = []
  for (const date of days) {
    const rate = pickRate(rates, date)
    if (!rate) {
      errors.push(`Нет цены на ${date}`)
      continue
    }
    const extraGuestsCost = extraGuests * rate.extraGuestPrice
    nights.push({
      date,
      rate: rate.name,
      base: rate.pricePerNight,
      extraGuests,
      extraGuestsCost,
      total: rate.pricePerNight + extraGuestsCost,
    })
  }

  const chosen = extras.filter((e) => extraIds.includes(e.id))
  const extraLines: QuoteExtraLine[] = chosen.map((e) => {
    const qty = e.priceType === 'per_night' ? days.length : e.priceType === 'per_person' ? guests : 1
    return { id: e.id, name: e.name, qty, unitPrice: e.price, total: qty * e.price }
  })

  const lodging = nights.reduce((s, n) => s + n.total, 0)
  const extrasTotal = extraLines.reduce((s, l) => s + l.total, 0)

  return {
    ok: errors.length === 0,
    errors,
    nights,
    lodging,
    extras: extraLines,
    extrasTotal,
    total: lodging + extrasTotal,
  }
}

export function formatMoney(n: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(n)} BYN`
}
