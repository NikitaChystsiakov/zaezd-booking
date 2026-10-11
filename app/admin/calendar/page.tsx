import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'
import { ACTIVE, OCCUPYING } from '@/lib/domain'
import { addDays, daysBetween, todayISO, toDate, toISO, weekday, weekdayShort, type ISODate } from '@/lib/dates'
import { BlockForm } from '@/components/admin/BlockForm'
import { DeleteBlockButton } from '@/components/admin/DeleteBlockButton'

export const metadata: Metadata = { title: 'Календарь' }

const DAYS = 35
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

type Bar = { from: ISODate; to: ISODate; label: string; href?: string; kind: 'booked' | 'done' | 'block' | 'feed' | 'request'; blockId?: string }

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const session = await requireSession()
  const sp = await searchParams
  const property = await prisma.property.findUniqueOrThrow({ where: { id: session.propertyId } })
  const today = todayISO(property.timezone)
  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : addDays(today, -3)
  const to = addDays(from, DAYS)

  const units = await prisma.unit.findMany({
    where: { propertyId: session.propertyId, active: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      leads: {
        where: { status: { in: [...OCCUPYING, ...ACTIVE] }, checkIn: { lt: toDate(to) }, checkOut: { gt: toDate(from) } },
        select: { id: true, name: true, occasion: true, status: true, checkIn: true, checkOut: true, guests: true },
      },
      blocks: {
        where: { start: { lt: toDate(to) }, end: { gt: toDate(from) } },
        include: { feed: { select: { label: true } } },
      },
    },
  })

  const days = Array.from({ length: DAYS }, (_, i) => addDays(from, i))
  const col = (d: ISODate) => Math.max(0, Math.min(DAYS, daysBetween(from, d)))

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Календарь</h1>
          <p className="mt-1 text-sm text-ink-2">Брони, заявки в работе и занятость из Куфара, Реалта и Google Календаря — в одном месте</p>
        </div>
        <div className="flex items-center gap-2">
          <Link className="btn-ghost btn-sm" href={`/admin/calendar?from=${addDays(from, -14)}`} aria-label="Раньше">
            <ChevronLeft size={15} />
          </Link>
          <Link className="btn-ghost btn-sm" href="/admin/calendar">
            Сегодня
          </Link>
          <Link className="btn-ghost btn-sm" href={`/admin/calendar?from=${addDays(from, 14)}`} aria-label="Позже">
            <ChevronRight size={15} />
          </Link>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-2">
        <Legend cls="bg-ok">Бронь</Legend>
        <Legend cls="border border-dashed border-warn bg-warn-soft">Заявка в работе</Legend>
        <Legend cls="hatch bg-surface-2">Внешний календарь</Legend>
        <Legend cls="bg-ink-3">Закрыто вручную</Legend>
      </div>

      <div className="card -mx-4 overflow-x-auto sm:mx-0">
        <div className="min-w-[1100px]" style={{ display: 'grid', gridTemplateColumns: `180px repeat(${DAYS}, minmax(26px, 1fr))` }}>
          {/* Шапка с датами */}
          <div className="sticky left-0 z-10 border-b border-r border-line bg-surface" />
          {days.map((d) => {
            const we = weekday(d) === 0 || weekday(d) === 6
            const isToday = d === today
            const first = d.endsWith('-01') || d === from
            return (
              <div key={d} className={`border-b border-line py-2 text-center text-[11px] leading-tight ${we ? 'bg-surface-2' : ''}`}>
                <div className="text-ink-3">{first ? MONTHS_SHORT[toDate(d).getUTCMonth()] : weekdayShort(d)}</div>
                <div className={`mx-auto mt-0.5 grid size-6 place-items-center rounded-full tabular-nums ${isToday ? 'bg-accent font-semibold text-accent-ink' : 'font-medium'}`}>
                  {Number(d.slice(8))}
                </div>
              </div>
            )
          })}

          {units.map((u) => {
            const booked: Bar[] = [
              ...u.leads
                .filter((l) => OCCUPYING.includes(l.status))
                .map<Bar>((l) => ({ from: toISO(l.checkIn), to: toISO(l.checkOut), label: `${l.name} · ${l.guests}`, href: `/admin/leads/${l.id}`, kind: l.status === 'done' ? 'done' : 'booked' })),
              ...u.blocks.map<Bar>((b) => ({ from: toISO(b.start), to: toISO(b.end), label: b.feed ? b.feed.label : b.reason ?? 'Закрыто', kind: b.feed ? 'feed' : 'block', blockId: b.feed ? undefined : b.id })),
            ]
            const requests: Bar[] = u.leads
              .filter((l) => ACTIVE.includes(l.status))
              .map((l) => ({ from: toISO(l.checkIn), to: toISO(l.checkOut), label: `${l.name}${l.occasion ? ` · ${l.occasion}` : ''}`, href: `/admin/leads/${l.id}`, kind: 'request' }))

            return (
              <div key={u.id} className="contents">
                <div className="sticky left-0 z-10 flex flex-col justify-center border-b border-r border-line bg-surface px-4 py-3">
                  <div className="truncate text-sm font-medium">{u.name}</div>
                  <div className="text-xs text-ink-3">до {u.capacity} гостей</div>
                </div>
                <div
                  className="relative border-b border-line"
                  style={{ gridColumn: `2 / span ${DAYS}`, display: 'grid', gridTemplateColumns: `repeat(${DAYS}, minmax(26px, 1fr))`, gridTemplateRows: '30px 22px', rowGap: 4, padding: '8px 0' }}
                >
                  {days.map((d, i) => (
                    <div
                      key={d}
                      className={`${weekday(d) === 0 || weekday(d) === 6 ? 'bg-surface-2' : ''} ${d === today ? 'border-l-2 border-accent' : ''}`}
                      style={{ gridColumn: i + 1, gridRow: '1 / span 2', margin: '-8px 0' }}
                    />
                  ))}
                  {booked.map((b, i) => (
                    <BarView key={`b${i}`} bar={b} start={col(b.from)} end={col(b.to)} row={1} />
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
        <section className="card p-5">
          <h2 className="mb-1 font-semibold">Закрыть даты</h2>
          <p className="mb-4 text-sm text-ink-2">Ремонт, свои гости, бронь по телефону без заявки.</p>
          <BlockForm units={units.map((u) => ({ id: u.id, name: u.name }))} today={today} />
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Закрыто вручную</h2>
          <ul className="space-y-2 text-sm">
            {units.flatMap((u) =>
              u.blocks
                .filter((b) => !b.feed)
                .map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3">
                    <span>
                      <span className="font-medium">{u.name}</span>
                      <span className="text-ink-2">
                        {' '}
                        · {toISO(b.start)} → {toISO(b.end)} · {b.reason}
                      </span>
                    </span>
                    <DeleteBlockButton id={b.id} />
                  </li>
                )),
            )}
            {units.every((u) => u.blocks.every((b) => b.feed)) && <li className="text-ink-3">Нет закрытых дат в этом периоде</li>}
          </ul>
        </section>
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

const BAR_CLS: Record<Bar['kind'], string> = {
  booked: 'bg-ok text-white',
  done: 'bg-ok/50 text-white',
  block: 'bg-ink-3 text-paper',
  feed: 'hatch bg-surface-2 text-ink-2 border border-line-strong',
  request: 'border border-dashed border-warn bg-warn-soft text-warn',
}

function BarView({ bar, start, end, row }: { bar: Bar; start: number; end: number; row: number }) {
  if (end <= start) return null
  const cls = `relative z-[1] mx-[2px] flex items-center overflow-hidden rounded-md px-2 text-xs font-medium whitespace-nowrap ${BAR_CLS[bar.kind]}`
  const style = { gridColumn: `${start + 1} / ${end + 1}`, gridRow: row }
  const content = <span className="truncate">{bar.label}</span>
  return bar.href ? (
    <Link href={bar.href} className={`${cls} hover:brightness-95`} style={style} title={bar.label}>
      {content}
    </Link>
  ) : (
    <div className={cls} style={style} title={bar.label}>
      {content}
    </div>
  )
}
