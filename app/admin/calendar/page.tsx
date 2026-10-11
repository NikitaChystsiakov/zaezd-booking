import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'
import { ACTIVE, OCCUPYING } from '@/lib/domain'
import { addDays, daysBetween, formatRange, todayISO, toDate, toISO, weekday, weekdayShort, type ISODate } from '@/lib/dates'
import { BlockForm } from '@/components/admin/BlockForm'
import { DeleteBlockButton } from '@/components/admin/DeleteBlockButton'
import { PageHeader, Section } from '@/components/admin/ui'

export const metadata: Metadata = { title: 'Календарь' }

const DAYS = 28
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

type Bar = { from: ISODate; to: ISODate; label: string; href?: string; kind: 'booked' | 'done' | 'block' | 'feed' | 'request' }

const BAR: Record<Bar['kind'], string> = {
  booked: 'bg-accent text-accent-ink',
  done: 'bg-accent/45 text-accent-ink',
  block: 'bg-ink-3 text-surface',
  feed: 'hatch border border-line-strong bg-surface-2 text-ink-2',
  request: 'border border-dashed border-brass bg-brass-soft text-ink',
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const session = await requireSession()
  const sp = await searchParams
  const property = await prisma.property.findUniqueOrThrow({ where: { id: session.propertyId } })
  const today = todayISO(property.timezone)
  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : addDays(today, -1)
  const to = addDays(from, DAYS)
  const holidays = new Set(property.holidays)

  const units = await prisma.unit.findMany({
    where: { propertyId: session.propertyId },
    orderBy: { sortOrder: 'asc' },
    include: {
      leads: {
        where: { status: { in: [...OCCUPYING, ...ACTIVE] }, checkIn: { lt: toDate(to) }, checkOut: { gt: toDate(from) } },
        select: { id: true, name: true, status: true, checkIn: true, checkOut: true, guests: true },
      },
      blocks: { where: { start: { lt: toDate(to) }, end: { gt: toDate(from) } }, include: { feed: { select: { label: true } } } },
    },
  })
  const upcomingBlocks = await prisma.block.findMany({
    where: { unit: { propertyId: session.propertyId }, feedId: null, end: { gt: toDate(today) } },
    include: { unit: { select: { name: true } } },
    orderBy: { start: 'asc' },
  })

  const days = Array.from({ length: DAYS }, (_, i) => addDays(from, i))
  const col = (d: ISODate) => Math.max(0, Math.min(DAYS, daysBetween(from, d)))
  const fromD = toDate(from)
  const toD = toDate(addDays(to, -1))
  const period =
    fromD.getUTCMonth() === toD.getUTCMonth()
      ? `${MONTHS[fromD.getUTCMonth()]} ${fromD.getUTCFullYear()}`
      : `${MONTHS_SHORT[fromD.getUTCMonth()]} — ${MONTHS_SHORT[toD.getUTCMonth()]} ${toD.getUTCFullYear()}`

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Календарь" sub="Брони, заявки в работе и занятость с Куфара, Реалта и Google Календаря — на одной ленте.">
        <Link className="btn-ghost btn-sm size-8 px-0" href={`/admin/calendar?from=${addDays(from, -14)}`} aria-label="Раньше">
          <ChevronLeft size={16} />
        </Link>
        <Link className="btn-ghost btn-sm" href="/admin/calendar">
          Сегодня
        </Link>
        <Link className="btn-ghost btn-sm size-8 px-0" href={`/admin/calendar?from=${addDays(from, 14)}`} aria-label="Позже">
          <ChevronRight size={16} />
        </Link>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm font-semibold capitalize">{period}</div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-2">
          <Legend cls="bg-accent">Подтверждённая бронь</Legend>
          <Legend cls="border border-dashed border-brass bg-brass-soft">Заявка в работе</Legend>
          <Legend cls="hatch border border-line-strong bg-surface-2">Внешний календарь</Legend>
          <Legend cls="bg-ink-3">Закрыто вручную</Legend>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <div className="min-w-[1520px]" style={{ display: 'grid', gridTemplateColumns: `168px repeat(${DAYS}, minmax(48px, 1fr))` }}>
          <div className="sticky left-0 z-10 border-r border-b border-line bg-surface" />
          {days.map((d) => {
            const we = weekday(d) === 0 || weekday(d) === 6
            return (
              <div key={d} className={`border-b border-line py-2.5 text-center text-[11px] leading-tight ${we ? 'bg-surface-2' : ''}`}>
                <div className={holidays.has(d) ? 'font-bold text-brass' : 'text-ink-3'}>{d.endsWith('-01') ? MONTHS_SHORT[toDate(d).getUTCMonth()] : weekdayShort(d)}</div>
                <div className={`mx-auto mt-1 grid size-6 place-items-center rounded-full font-semibold tabular-nums ${d === today ? 'bg-brass text-white' : ''}`}>{Number(d.slice(8))}</div>
              </div>
            )
          })}

          {units.map((u) => {
            const solid: Bar[] = [
              ...u.leads.filter((l) => OCCUPYING.includes(l.status)).map<Bar>((l) => ({ from: toISO(l.checkIn), to: toISO(l.checkOut), label: `${l.name} · ${l.guests}`, href: `/admin/leads/${l.id}`, kind: l.status === 'done' ? 'done' : 'booked' })),
              ...u.blocks.map<Bar>((b) => ({ from: toISO(b.start), to: toISO(b.end), label: b.feed ? b.feed.label : (b.reason ?? 'Закрыто'), kind: b.feed ? 'feed' : 'block' })),
            ]
            const requests: Bar[] = u.leads
              .filter((l) => ACTIVE.includes(l.status))
              .map((l) => ({ from: toISO(l.checkIn), to: toISO(l.checkOut), label: l.name, href: `/admin/leads/${l.id}`, kind: 'request' }))

            return (
              <div key={u.id} className="contents">
                <div className="sticky left-0 z-10 flex items-center gap-3 border-r border-b border-line bg-surface px-4 py-3">
                  {u.photos[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.photos[0]} alt="" className="photo-grade size-9 rounded-lg object-cover" />
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{u.name}</div>
                    <div className="text-xs text-ink-3">до {u.capacity} гостей</div>
                  </div>
                </div>
                <div
                  className="relative border-b border-line"
                  style={{ gridColumn: `2 / span ${DAYS}`, display: 'grid', gridTemplateColumns: `repeat(${DAYS}, minmax(48px, 1fr))`, gridTemplateRows: '34px 26px', rowGap: 6, padding: '10px 0' }}
                >
                  {days.map((d, i) => (
                    <div
                      key={d}
                      className={`${weekday(d) === 0 || weekday(d) === 6 ? 'bg-surface-2' : ''} ${d === today ? 'border-l-2 border-brass' : ''}`}
                      style={{ gridColumn: i + 1, gridRow: '1 / span 2', margin: '-10px 0' }}
                    />
                  ))}
                  {solid.map((b, i) => (
                    <BarView key={`s${i}`} bar={b} start={col(b.from)} end={col(b.to)} row={1} />
                  ))}
                  {requests.map((b, i) => (
                    <BarView key={`r${i}`} bar={b} start={col(b.from)} end={col(b.to)} row={2} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Section title="Закрыть даты" sub="Бронь по телефону без заявки, ремонт, свои гости — эти даты исчезнут из свободных на сайте.">
          <BlockForm units={units.map((u) => ({ id: u.id, name: u.name }))} today={today} />
        </Section>
        <Section title="Закрыто вручную">
          {upcomingBlocks.length ? (
            <ul className="divide-y divide-line text-sm">
              {upcomingBlocks.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                  <div>
                    <div className="font-semibold">
                      {b.unit.name} · {formatRange(toISO(b.start), toISO(b.end))}
                    </div>
                    <div className="text-ink-3">{b.reason}</div>
                  </div>
                  <DeleteBlockButton id={b.id} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-3">Ничего не закрыто</p>
          )}
        </Section>
      </div>
    </div>
  )
}

function Legend({ cls, children }: { cls: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`inline-block h-3 w-5 rounded ${cls}`} /> {children}
    </span>
  )
}

function BarView({ bar, start, end, row }: { bar: Bar; start: number; end: number; row: number }) {
  if (end <= start) return null
  const cls = `relative z-[1] mx-[2px] flex items-center overflow-hidden rounded-full px-3 text-xs font-semibold whitespace-nowrap ${BAR[bar.kind]}`
  const style = { gridColumn: `${start + 1} / ${end + 1}`, gridRow: row }
  const content = <span className="truncate">{bar.label}</span>
  return bar.href ? (
    <Link href={bar.href} className={`${cls} hover:opacity-90`} style={style} title={bar.label}>
      {content}
    </Link>
  ) : (
    <div className={cls} style={style} title={bar.label}>
      {content}
    </div>
  )
}
