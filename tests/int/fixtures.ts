import { rm } from 'node:fs/promises'
import { prisma } from '@/lib/prisma'
import { signJwt, getCookieName } from '@/lib/jwt'
import { addDays, todayISO, toDate } from '@/lib/dates'
import { cookieJar } from './setup'

export const today = todayISO()
export const day = (n: number) => addDays(today, n)

/** Чистая база перед каждым тестом */
export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Property", "User", "Unit", "Rate", "Extra", "Lead", "LeadEvent", "Proposal", "Contribution", "Block", "CalendarFeed" CASCADE',
  )
  await rm(process.env.UPLOAD_DIR!, { recursive: true, force: true })
  cookieJar.clear()
}

/**
 * Усадьба с одним домом на 10 гостей: будни 300, суббота 500, праздник 600,
 * небольшая компания до 4 — 150 + 50 за гостя, открыта за 14 дней.
 */
export async function makeProperty(slug: string, opts: { showAvailability?: boolean } = {}) {
  const property = await prisma.property.create({
    data: {
      slug,
      name: `Усадьба ${slug}`,
      holidays: [day(40)],
      showAvailability: opts.showAvailability ?? true,
      depositPercent: 40,
    },
  })
  const user = await prisma.user.create({
    data: { propertyId: property.id, email: `${slug}@test.by`, name: 'Админ', passwordHash: 'x', role: 'owner' },
  })
  const unit = await prisma.unit.create({
    data: {
      propertyId: property.id,
      slug: 'dom',
      name: 'Дом',
      capacity: 10,
      longStayFromNight: 3,
      longStayPercent: 10,
      rates: {
        create: [
          { name: 'Будни', weekdays: [], includedGuests: 8, pricePerNight: 300, extraGuestPrice: 40 },
          { name: 'Суббота', weekdays: [6], includedGuests: 8, pricePerNight: 500, extraGuestPrice: 40, priority: 5 },
          { name: 'Праздник', weekdays: [], holidaysOnly: true, includedGuests: 8, pricePerNight: 600, extraGuestPrice: 40, priority: 10 },
          { name: 'Компания', weekdays: [], maxGuests: 4, includedGuests: 2, pricePerNight: 150, extraGuestPrice: 50, bookableWithinDays: 14 },
        ],
      },
    },
  })
  const bath = await prisma.extra.create({
    data: { propertyId: property.id, name: 'Баня', priceType: 'per_item', price: 100, unitLabel: 'сеанс', maxQty: 2 },
  })
  return { property, user, unit, bath }
}

export async function loginAs(user: { id: string; propertyId: string; role: 'owner' | 'admin' | 'staff' }) {
  cookieJar.set(getCookieName(), await signJwt({ sub: user.id, propertyId: user.propertyId, role: user.role }))
}

export async function makeLead(propertyId: string, unitId: string, from: number, nights: number, status: 'new' | 'contacted' | 'booked' | 'done' = 'new') {
  return prisma.lead.create({
    data: {
      propertyId,
      unitId,
      status,
      checkIn: toDate(day(from)),
      checkOut: toDate(day(from + nights)),
      guests: 4,
      name: `Гость ${from}`,
      phone: '+375290000000',
    },
  })
}

/** Ближайшая дата с нужным днём недели не раньше чем через minAhead дней */
export function nextWeekday(dow: number, minAhead: number): number {
  for (let i = minAhead; i < minAhead + 7; i++) if (new Date(`${day(i)}T00:00:00Z`).getUTCDay() === dow) return i
  throw new Error('unreachable')
}
