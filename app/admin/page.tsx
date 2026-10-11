import Link from 'next/link'
import { Eye, Flame, Phone, Send, MessageCircle, Users, AlertCircle } from 'lucide-react'
import type { Metadata } from 'next'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'
import { ago, minutesSince, PIPELINE, STATUS } from '@/lib/domain'
import { formatRange, todayISO, toDate, toISO, addDays, plural } from '@/lib/dates'
import { formatMoney } from '@/lib/quote'

export const metadata: Metadata = { title: 'Заявки' }

const COLUMN_HINT: Record<string, string> = {
  new: 'Позвонить или написать',
  contacted: 'Собрать и отправить КП',
  proposal: 'Дождаться предоплаты',
  booked: 'Ближайшие заезды',
}

const VIA_ICON = { call: Phone, telegram: Send, viber: MessageCircle }

export default async function LeadsBoard({ searchParams }: { searchParams: Promise<{ archive?: string }> }) {
  const session = await requireSession()
  const { archive } = await searchParams
  const property = await prisma.property.findUniqueOrThrow({ where: { id: session.propertyId } })
  const today = todayISO(property.timezone)

  const leads = await prisma.lead.findMany({
    where: {
      propertyId: session.propertyId,
      status: archive ? { in: ['done', 'lost'] } : { in: PIPELINE },
      // Прошедшие брони уходят с доски
      ...(archive ? {} : { NOT: { status: 'booked', checkOut: { lt: toDate(today) } } }),
    },
    include: cardInclude,
    orderBy: [{ createdAt: 'desc' }],
  })

  const now = new Date()
  const waiting = leads.filter((l) => l.status === 'new')
  const overdue = waiting.filter((l) => minutesSince(l.createdAt, now) > property.callbackMinutes)
  const inWork = leads.filter((l) => ['new', 'contacted', 'proposal'].includes(l.status)).reduce((s, l) => s + (l.estimate ?? 0), 0)
  const weekEnd = addDays(today, 7)
  const arrivals = leads.filter((l) => l.status === 'booked' && toISO(l.checkIn) >= today && toISO(l.checkIn) < weekEnd)
  const hot = leads.filter((l) => l.status === 'proposal' && l.proposal?.lastViewedAt && minutesSince(l.proposal.lastViewedAt, now) < 60)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{archive ? 'Архив заявок' : 'Заявки'}</h1>
          <p className="mt-1 text-sm text-ink-2">
            {archive ? 'Состоявшиеся заезды и отказы' : `Перезвонить по новой заявке — в течение ${property.callbackMinutes} мин`}
          </p>
        </div>
        <Link href={archive ? '/admin' : '/admin?archive=1'} className="btn-ghost btn-sm">
          {archive ? '← К доске' : 'Архив'}
        </Link>
      </div>

      {!archive && (
        <div className="mb-8 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Stat
            label="Ждут звонка"
            value={String(waiting.length)}
            note={overdue.length ? `${overdue.length} ${plural(overdue.length, 'просрочена', 'просрочены', 'просрочено')}` : 'всё вовремя'}
            alert={overdue.length > 0}
          />
          <Stat label="КП открывают сейчас" value={String(hot.length)} note={hot.length ? 'самое время позвонить' : 'за последний час'} />
          <Stat label="В работе на сумму" value={formatMoney(inWork)} note="по расчёту из заявок" />
          <Stat label="Заезды на неделе" value={String(arrivals.length)} note={arrivals[0] ? `ближайший ${formatRange(toISO(arrivals[0].checkIn), toISO(arrivals[0].checkOut))}` : 'пока нет'} />
        </div>
      )}

      {archive ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {leads.map((l) => (
            <LeadCard key={l.id} lead={l} now={now} callbackMinutes={property.callbackMinutes} />
          ))}
        </div>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8">
          <div className="grid min-w-[1040px] grid-cols-4 gap-4">
            {PIPELINE.map((status) => {
              const col = leads
                .filter((l) => l.status === status)
                .sort((a, b) => (status === 'booked' ? a.checkIn.getTime() - b.checkIn.getTime() : 0))
              return (
                <section key={status} className="min-w-0">
                  <header className="mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <span className={`chip ${STATUS[status].tone}`}>{STATUS[status].short}</span>
                      <span className="text-sm tabular-nums text-ink-3">{col.length}</span>
                    </div>
                    <p className="mt-1 text-xs text-ink-3">{COLUMN_HINT[status]}</p>
                  </header>
                  <div className="space-y-3">
                    {col.map((l) => (
                      <LeadCard key={l.id} lead={l} now={now} callbackMinutes={property.callbackMinutes} />
                    ))}
                    {col.length === 0 && <div className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-3">Пусто</div>}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, note, alert }: { label: string; value: string; note: string; alert?: boolean }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-ink-3">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      <div className={`mt-1 text-xs ${alert ? 'font-medium text-accent' : 'text-ink-3'}`}>{note}</div>
    </div>
  )
}

const cardInclude = {
  unit: { select: { name: true } },
  proposal: { select: { views: true, lastViewedAt: true, prepaymentAmount: true, contributions: { select: { amount: true, status: true } } } },
} satisfies Prisma.LeadInclude

type CardLead = Prisma.LeadGetPayload<{ include: typeof cardInclude }>

function LeadCard({ lead, now, callbackMinutes }: { lead: CardLead; now: Date; callbackMinutes: number }) {
  const waitedMin = minutesSince(lead.createdAt, now)
  const late = lead.status === 'new' && waitedMin > callbackMinutes
  const Via = VIA_ICON[lead.contactVia]
  const p = lead.proposal
  const collected = p ? p.contributions.filter((c) => c.status === 'confirmed').reduce((s, c) => s + c.amount, 0) : 0
  const hot = lead.status === 'proposal' && p?.lastViewedAt && minutesSince(p.lastViewedAt, now) < 60

  return (
    <Link
      href={`/admin/leads/${lead.id}`}
      className={`card block p-4 transition-shadow hover:shadow-[0_2px_12px_rgba(0,0,0,.06)] ${late ? 'border-accent/50' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium">{lead.name}</div>
          <div className="truncate text-sm text-ink-2">{lead.occasion ?? 'Без повода'}</div>
        </div>
        <Via size={15} className="mt-1 shrink-0 text-ink-3" aria-label={lead.contactVia} />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-ink-2">
        <span>{formatRange(toISO(lead.checkIn), toISO(lead.checkOut))}</span>
        <span className="flex items-center gap-1">
          <Users size={13} /> {lead.guests}
        </span>
        <span className={lead.unit ? '' : 'text-warn'}>{lead.unit?.name ?? 'Объект не выбран'}</span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs">
        <span className="font-medium tabular-nums">{lead.estimate ? formatMoney(lead.estimate) : '—'}</span>
        {late ? (
          <span className="flex items-center gap-1 font-medium text-accent">
            <AlertCircle size={13} /> ждёт {ago(lead.createdAt, now).replace(' назад', '')}
          </span>
        ) : hot ? (
          <span className="flex items-center gap-1 font-medium text-warn">
            <Flame size={13} /> КП открыли {ago(p!.lastViewedAt!, now)}
          </span>
        ) : p && lead.status === 'proposal' ? (
          <span className="flex items-center gap-1 text-ink-3">
            <Eye size={13} /> {p.views} · собрано {collected}/{p.prepaymentAmount}
          </span>
        ) : (
          <span className="text-ink-3">{ago(lead.createdAt, now)}</span>
        )}
      </div>
    </Link>
  )
}
