import { prisma } from '@/lib/prisma'
import { buildIcal } from '@/lib/ical'
import { toISO } from '@/lib/dates'
import { OCCUPYING } from '@/lib/domain'

// Публичная лента занятости объекта по секретной ссылке.
// Имён гостей наружу не отдаём — только «Занято».
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const unit = await prisma.unit.findUnique({
    where: { icalToken: token.replace(/\.ics$/, '') },
    include: {
      leads: { where: { status: { in: OCCUPYING } }, select: { id: true, checkIn: true, checkOut: true } },
      // Блокировки из чужих лент не отдаём обратно — иначе календари начнут бесконечно пересылать друг другу одно и то же
      blocks: { where: { feedId: null }, select: { id: true, start: true, end: true } },
    },
  })
  if (!unit) return new Response('Not found', { status: 404 })

  const body = buildIcal(unit.name, [
    ...unit.leads.map((l) => ({ uid: `lead-${l.id}@zaezd`, start: toISO(l.checkIn), end: toISO(l.checkOut), summary: 'Занято' })),
    ...unit.blocks.map((b) => ({ uid: `block-${b.id}@zaezd`, start: toISO(b.start), end: toISO(b.end), summary: 'Закрыто' })),
  ])

  return new Response(body, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  })
}
