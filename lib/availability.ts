import 'server-only'
import { prisma } from './prisma'
import { ACTIVE, OCCUPYING } from './domain'
import { addDays, eachDay, toDate, toISO, type ISODate } from './dates'

export type Conflict = {
  kind: 'booking' | 'block' | 'request'
  label: string
  from: ISODate
  to: ISODate
  leadId?: string
}

/**
 * Что пересекается с датами заявки на этом объекте.
 * booking/block — даты реально заняты; request — другие заявки в работе на те же даты.
 */
export async function findConflicts(unitId: string, checkIn: Date, checkOut: Date, excludeLeadId?: string): Promise<Conflict[]> {
  const [leads, blocks] = await Promise.all([
    prisma.lead.findMany({
      where: {
        unitId,
        id: excludeLeadId ? { not: excludeLeadId } : undefined,
        status: { in: [...OCCUPYING, ...ACTIVE] },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
      select: { id: true, name: true, status: true, occasion: true, checkIn: true, checkOut: true },
    }),
    prisma.block.findMany({
      where: { unitId, start: { lt: checkOut }, end: { gt: checkIn } },
      include: { feed: { select: { label: true } } },
    }),
  ])

  return [
    ...leads.map<Conflict>((l) => ({
      kind: OCCUPYING.includes(l.status) ? 'booking' : 'request',
      label: `${l.name}${l.occasion ? ` · ${l.occasion}` : ''}`,
      from: toISO(l.checkIn),
      to: toISO(l.checkOut),
      leadId: l.id,
    })),
    ...blocks.map<Conflict>((b) => ({
      kind: 'block',
      label: b.feed ? `Занято в «${b.feed.label}»` : b.reason || 'Закрыто',
      from: toISO(b.start),
      to: toISO(b.end),
    })),
  ]
}

/** Занятые ночи по объектам на horizon дней вперёд — для календаря на сайте (если владелец разрешил) */
export async function busyNights(propertyId: string, from: ISODate, horizon: number): Promise<Record<string, ISODate[]>> {
  const to = addDays(from, horizon)
  const [leads, blocks] = await Promise.all([
    prisma.lead.findMany({
      where: { propertyId, unitId: { not: null }, status: { in: OCCUPYING }, checkIn: { lt: toDate(to) }, checkOut: { gt: toDate(from) } },
      select: { unitId: true, checkIn: true, checkOut: true },
    }),
    prisma.block.findMany({
      where: { unit: { propertyId }, start: { lt: toDate(to) }, end: { gt: toDate(from) } },
      select: { unitId: true, start: true, end: true },
    }),
  ])
  const out: Record<string, Set<ISODate>> = {}
  const add = (unitId: string, a: Date, b: Date) => {
    out[unitId] ??= new Set()
    for (const d of eachDay(toISO(a), toISO(b))) out[unitId].add(d)
  }
  for (const l of leads) add(l.unitId!, l.checkIn, l.checkOut)
  for (const b of blocks) add(b.unitId, b.start, b.end)
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v].sort()]))
}

/** Ошибка Postgres от ограничения Lead_no_double_booking */
export function isDoubleBookingError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return msg.includes('Lead_no_double_booking') || msg.includes('23P01')
}
