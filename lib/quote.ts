// Расчёт стоимости заезда. Чистая функция без обращений к БД:
// её используют страница бронирования, админка и проверка тарифов.

import { daysBetween, eachDay, toISO, weekday, type ISODate } from './dates'

export type QuoteUnit = {
  name: string
  capacity: number
  longStayFromNight: number | null
  longStayPercent: number
}

export type QuoteRate = {
  name: string
  weekdays: number[]
  holidaysOnly: boolean
  startDate: Date | ISODate | null
  endDate: Date | ISODate | null
  minGuests: number
  maxGuests: number | null
  includedGuests: number
  pricePerNight: number
  extraGuestPrice: number
  bookableWithinDays: number | null
  priority: number
}

export type QuoteExtra = {
  id: string
  name: string
  priceType: 'per_stay' | 'per_night' | 'per_person' | 'per_item'
  price: number
  unitLabel: string | null
  maxQty: number
}

export type ExtraPick = { id: string; qty: number }

export type QuoteInput = {
  unit: QuoteUnit
  rates: QuoteRate[]
  extras: QuoteExtra[]
  picks: ExtraPick[]
  checkIn: ISODate
  checkOut: ISODate
  guests: number
  holidays: ISODate[]
  /** От этой даты считается «окно бронирования» тарифов */
  today: ISODate
}

export type QuoteNight = {
  date: ISODate
  rate: string
  holiday: boolean
  base: number
  extraGuests: number
  extraGuestsCost: number
  discount: number
  total: number
}

export type QuoteExtraLine = { id: string; name: string; qty: number; unitLabel: string | null; unitPrice: number; total: number }

export type Quote = {
  ok: boolean
  errors: string[]
  /** Пояснения для гостя: почему не применился выгодный тариф и т.п. */
  notes: string[]
  nights: QuoteNight[]
  lodging: number
  discount: number
  extras: QuoteExtraLine[]
  extrasTotal: number
  total: number
}

const iso = (d: Date | ISODate | null) => (d === null ? null : typeof d === 'string' ? d : toISO(d))

function matchesDate(r: QuoteRate, date: ISODate, isHoliday: boolean): boolean {
  if (r.holidaysOnly && !isHoliday) return false
  const start = iso(r.startDate)
  const end = iso(r.endDate)
  if (start && date < start) return false
  if (end && date > end) return false
  if (r.weekdays.length > 0 && !r.weekdays.includes(weekday(date))) return false
  return true
}

function matchesGuests(r: QuoteRate, guests: number): boolean {
  return guests >= r.minGuests && (r.maxGuests === null || guests <= r.maxGuests)
}

export function nightPrice(r: QuoteRate, guests: number) {
  const extraGuests = Math.max(0, guests - r.includedGuests)
  return { extraGuests, extraGuestsCost: extraGuests * r.extraGuestPrice, total: r.pricePerNight + extraGuests * r.extraGuestPrice }
}

/**
 * Тариф на ночь: из подходящих по дате, числу гостей и окну бронирования берём
 * группу с наибольшим приоритетом (праздники важнее будней), а в ней — самый выгодный для гостя.
 */
export function pickRate(
  rates: QuoteRate[],
  date: ISODate,
  ctx: { guests: number; isHoliday: boolean; daysAhead: number },
): { rate: QuoteRate | null; closedByWindow: QuoteRate[] } {
  const byDate = rates.filter((r) => matchesDate(r, date, ctx.isHoliday) && matchesGuests(r, ctx.guests))
  const closedByWindow = byDate.filter((r) => r.bookableWithinDays !== null && ctx.daysAhead > r.bookableWithinDays)
  const open = byDate.filter((r) => !closedByWindow.includes(r))
  if (!open.length) return { rate: null, closedByWindow }

  const top = Math.max(...open.map((r) => r.priority))
  const best = open
    .filter((r) => r.priority === top)
    .reduce((a, b) => (nightPrice(b, ctx.guests).total < nightPrice(a, ctx.guests).total ? b : a))

  // Закрытые окном тарифы интересны гостю, только если были бы дешевле выбранного
  const cheaperClosed = closedByWindow.filter((r) => r.priority >= top && nightPrice(r, ctx.guests).total < nightPrice(best, ctx.guests).total)
  return { rate: best, closedByWindow: cheaperClosed }
}

export function quote(input: QuoteInput): Quote {
  const { unit, rates, extras, picks, checkIn, checkOut, guests, holidays, today } = input
  const errors: string[] = []
  const notes = new Set<string>()

  if (!(checkIn < checkOut)) errors.push('Дата выезда должна быть позже даты заезда')
  if (guests < 1) errors.push('Укажите количество гостей')
  if (guests > unit.capacity) errors.push(`${unit.name} вмещает до ${unit.capacity} гостей`)

  const days = checkIn < checkOut ? eachDay(checkIn, checkOut) : []
  const holidaySet = new Set(holidays)
  const daysAhead = daysBetween(today, checkIn)

  const nights: QuoteNight[] = []
  days.forEach((date, i) => {
    const isHoliday = holidaySet.has(date)
    const { rate, closedByWindow } = pickRate(rates, date, { guests, isHoliday, daysAhead })
    for (const r of closedByWindow) notes.add(`Тариф «${r.name}» открывается за ${r.bookableWithinDays} дн. до заезда — пока считаем по обычному`)
    if (!rate) {
      errors.push(`Нет цены на ${date} для ${guests} гостей`)
      return
    }
    const p = nightPrice(rate, guests)
    const longStay = unit.longStayFromNight !== null && unit.longStayPercent > 0 && i + 1 >= unit.longStayFromNight
    const discount = longStay ? Math.round((p.total * unit.longStayPercent) / 100) : 0
    nights.push({
      date,
      rate: rate.name,
      holiday: isHoliday,
      base: rate.pricePerNight,
      extraGuests: p.extraGuests,
      extraGuestsCost: p.extraGuestsCost,
      discount,
      total: p.total - discount,
    })
  })

  const extraLines: QuoteExtraLine[] = []
  for (const pick of picks) {
    const e = extras.find((x) => x.id === pick.id)
    if (!e || pick.qty < 1) continue
    const qty =
      e.priceType === 'per_night' ? days.length
      : e.priceType === 'per_person' ? guests
      : e.priceType === 'per_item' ? Math.min(Math.round(pick.qty), Math.max(1, e.maxQty))
      : 1
    extraLines.push({ id: e.id, name: e.name, qty, unitLabel: e.unitLabel, unitPrice: e.price, total: qty * e.price })
  }

  const lodging = nights.reduce((s, n) => s + n.total, 0)
  const discount = nights.reduce((s, n) => s + n.discount, 0)
  const extrasTotal = extraLines.reduce((s, l) => s + l.total, 0)

  return {
    ok: errors.length === 0,
    errors,
    notes: [...notes],
    nights,
    lodging,
    discount,
    extras: extraLines,
    extrasTotal,
    total: lodging + extrasTotal,
  }
}

export function depositFor(total: number, percent: number): number {
  return Math.ceil((total * percent) / 100)
}

export function formatMoney(n: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(n)} BYN`
}
