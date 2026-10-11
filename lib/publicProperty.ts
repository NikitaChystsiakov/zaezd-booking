import 'server-only'
import { prisma } from './prisma'
import { busyNights } from './availability'
import { todayISO, toISO } from './dates'
import { toQuoteRates } from './domain'
import type { WidgetExtra, WidgetUnit } from '@/components/BookingWidget'

/** Всё, что нужно странице бронирования и встраиваемому виджету */
export async function loadPublicProperty(slug: string) {
  const property = await prisma.property.findUnique({
    where: { slug },
    include: {
      units: { where: { active: true }, orderBy: { sortOrder: 'asc' }, include: { rates: { orderBy: { sortOrder: 'asc' } } } },
      extras: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
    },
  })
  if (!property) return null

  const today = todayISO(property.timezone)
  const busy = property.showAvailability ? await busyNights(property.id, today, 365) : null

  const units: WidgetUnit[] = property.units.map((u) => ({
    id: u.id,
    name: u.name,
    summary: u.summary,
    photo: u.photos[0] ?? null,
    capacity: u.capacity,
    longStayFromNight: u.longStayFromNight,
    longStayPercent: u.longStayPercent,
    rates: toQuoteRates(u.rates).map((r) => ({
      ...r,
      startDate: r.startDate ? toISO(r.startDate as Date) : null,
      endDate: r.endDate ? toISO(r.endDate as Date) : null,
    })),
  }))

  const extras: WidgetExtra[] = property.extras.map((e) => ({
    id: e.id,
    name: e.name,
    description: e.description,
    group: e.group,
    priceType: e.priceType,
    price: e.price,
    unitLabel: e.unitLabel,
    maxQty: e.maxQty,
  }))

  return { property, today, busy, units, extras }
}
