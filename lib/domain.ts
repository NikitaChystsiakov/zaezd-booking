// Справочники и преобразования, общие для страницы бронирования и админки.

import type { Extra, LeadStatus, Rate, Unit } from '@prisma/client'
import type { ExtraPick, QuoteExtra, QuoteRate, QuoteUnit } from './quote'

export const STATUS: Record<LeadStatus, { label: string; short: string; tone: string }> = {
  new: { label: 'Новая — ждёт ответа', short: 'Новая', tone: 'bg-accent-soft text-accent' },
  contacted: { label: 'Связались, ждём задаток', short: 'Ждём задаток', tone: 'bg-warn-soft text-warn' },
  proposal: { label: 'КП отправлено', short: 'КП', tone: 'bg-info-soft text-info' },
  booked: { label: 'Подтверждена — задаток получен', short: 'Подтверждена', tone: 'bg-ok-soft text-ok' },
  done: { label: 'Заезд состоялся', short: 'Состоялась', tone: 'bg-muted-soft text-ink-2' },
  lost: { label: 'Отказ', short: 'Отказ', tone: 'bg-muted-soft text-ink-3' },
}

/** Статусы, при которых даты считаются занятыми (совпадает с ограничением в БД) */
export const OCCUPYING: LeadStatus[] = ['booked', 'done']
/** Заявки в работе: даты ещё не заняты, но администратору важно о них знать */
export const ACTIVE: LeadStatus[] = ['new', 'contacted', 'proposal']

export const CONTACT_VIA = { call: 'звонок', telegram: 'Telegram', viber: 'Viber' } as const

export const PRICE_TYPE_LABEL: Record<QuoteExtra['priceType'], string> = {
  per_stay: 'за заезд',
  per_night: 'за ночь',
  per_person: 'за гостя',
  per_item: 'за единицу',
}

export const UNIT_KIND_LABEL: Record<Unit['kind'], string> = {
  house: 'Дом',
  room: 'Номер',
  venue: 'Площадка',
  whole: 'Вся усадьба',
}

export const WEEKDAYS_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']
/** Порядок дней для выбора в интерфейсе: с понедельника */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

export function weekdaysLabel(days: number[]): string {
  if (days.length === 0 || days.length === 7) return 'любой день'
  const sorted = WEEK_ORDER.filter((d) => days.includes(d))
  // Подряд идущие дни — диапазоном: «пн–чт»
  const idx = sorted.map((d) => WEEK_ORDER.indexOf(d))
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1)
  if (contiguous && sorted.length > 2) return `${WEEKDAYS_SHORT[sorted[0]]}–${WEEKDAYS_SHORT[sorted[sorted.length - 1]]}`
  return sorted.map((d) => WEEKDAYS_SHORT[d]).join(', ')
}

export function toQuoteUnit(u: Pick<Unit, 'name' | 'capacity' | 'longStayFromNight' | 'longStayPercent'>): QuoteUnit {
  return { name: u.name, capacity: u.capacity, longStayFromNight: u.longStayFromNight, longStayPercent: u.longStayPercent }
}

export function toQuoteRates(rates: Rate[]): QuoteRate[] {
  return rates.map((r) => ({
    name: r.name,
    weekdays: r.weekdays,
    holidaysOnly: r.holidaysOnly,
    startDate: r.startDate,
    endDate: r.endDate,
    minGuests: r.minGuests,
    maxGuests: r.maxGuests,
    includedGuests: r.includedGuests,
    pricePerNight: r.pricePerNight,
    extraGuestPrice: r.extraGuestPrice,
    bookableWithinDays: r.bookableWithinDays,
    priority: r.priority,
  }))
}

export function toQuoteExtras(extras: Extra[]): QuoteExtra[] {
  return extras.map((e) => ({ id: e.id, name: e.name, priceType: e.priceType, price: e.price, unitLabel: e.unitLabel, maxQty: e.maxQty }))
}

export function parsePicks(json: unknown): ExtraPick[] {
  if (!Array.isArray(json)) return []
  return json
    .filter((p): p is ExtraPick => !!p && typeof p.id === 'string' && typeof p.qty === 'number')
    .map((p) => ({ id: p.id, qty: p.qty }))
}

/** «25 мин назад», «3 ч назад», «вчера» */
export function ago(date: Date, now = new Date()): string {
  const min = Math.round((now.getTime() - date.getTime()) / 60_000)
  if (min < 1) return 'только что'
  if (min < 60) return `${min} мин назад`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} ч назад`
  const d = Math.round(h / 24)
  if (d === 1) return 'вчера'
  return `${d} дн назад`
}

export function minutesSince(date: Date, now = new Date()): number {
  return Math.round((now.getTime() - date.getTime()) / 60_000)
}

export type ProposalOption = { id: string; title: string; note?: string; price: number; extraIds: string[] }
