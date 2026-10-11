// Справочники и преобразования, общие для сайта, админки и КП.

import type { Extra, LeadStatus, Rate, Unit } from '@prisma/client'
import type { QuoteExtra, QuoteRate, QuoteUnit } from './quote'

export const STATUS: Record<LeadStatus, { label: string; short: string; tone: string }> = {
  new: { label: 'Новая — ждёт звонка', short: 'Новая', tone: 'bg-accent-soft text-accent' },
  contacted: { label: 'Созвонились', short: 'Созвонились', tone: 'bg-info-soft text-info' },
  proposal: { label: 'КП отправлено', short: 'КП', tone: 'bg-warn-soft text-warn' },
  booked: { label: 'Бронь — предоплата получена', short: 'Бронь', tone: 'bg-ok-soft text-ok' },
  done: { label: 'Заезд состоялся', short: 'Состоялся', tone: 'bg-muted-soft text-ink-2' },
  lost: { label: 'Отказ', short: 'Отказ', tone: 'bg-muted-soft text-ink-3' },
}

export const PIPELINE: LeadStatus[] = ['new', 'contacted', 'proposal', 'booked']

/** Статусы, при которых даты считаются занятыми (совпадает с ограничением в БД) */
export const OCCUPYING: LeadStatus[] = ['booked', 'done']
/** Заявки в работе: даты ещё не заняты, но администратору важно о них знать */
export const ACTIVE: LeadStatus[] = ['new', 'contacted', 'proposal']

export const CONTACT_VIA = { call: 'Позвонить', telegram: 'Telegram', viber: 'Viber' } as const

export const OCCASIONS = ['День рождения', 'Корпоратив', 'Девичник / мальчишник', 'Семейные выходные', 'Свадьба', 'Просто отдохнуть']

export const PRICE_TYPE_LABEL: Record<QuoteExtra['priceType'], string> = {
  per_stay: 'за заезд',
  per_night: 'за ночь',
  per_person: 'за человека',
  per_hour: 'за час',
}

export const UNIT_KIND_LABEL: Record<Unit['kind'], string> = {
  house: 'Дом',
  room: 'Номер',
  venue: 'Площадка',
  whole: 'Вся усадьба',
}

export function toQuoteUnit(u: Unit): QuoteUnit {
  return { name: u.name, kind: u.kind, capacity: u.capacity, baseGuests: u.baseGuests }
}

export function toQuoteRates(rates: Rate[]): QuoteRate[] {
  return rates.map((r) => ({
    name: r.name,
    startDate: r.startDate,
    endDate: r.endDate,
    weekdays: r.weekdays,
    pricePerNight: r.pricePerNight,
    extraGuestPrice: r.extraGuestPrice,
    priority: r.priority,
  }))
}

export function toQuoteExtras(extras: Extra[]): QuoteExtra[] {
  return extras.map((e) => ({ id: e.id, name: e.name, priceType: e.priceType, price: e.price }))
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
