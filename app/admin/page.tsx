import Link from 'next/link'
import type { Metadata } from 'next'
import type { LeadStatus, Prisma } from '@prisma/client'
import { ChevronRight, MessageCircle, Phone, Send } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'
import { ago, minutesSince, STATUS } from '@/lib/domain'
import { addDays, daysBetween, formatRange, plural, todayISO, toDate, toISO, weekdayShort } from '@/lib/dates'
import { formatMoney } from '@/lib/quote'
import { PageHeader } from '@/components/admin/ui'

export const metadata: Metadata = { title: 'Заявки' }

const TABS = {
  work: { label: 'В работе', statuses: ['new', 'contacted', 'proposal'] as LeadStatus[] },
  booked: { label: 'Подтверждённые', statuses: ['booked'] as LeadStatus[] },
  archive: { label: 'Архив', statuses: ['done', 'lost'] as LeadStatus[] },
}
type Tab = keyof typeof TABS

const VIA = { call: Phone, telegram: Send, viber: MessageCircle }

const include = { unit: { select: { name: true } } } satisfies Prisma.LeadInclude
type Row = Prisma.LeadGetPayload<{ include: typeof include }>

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await requireSession()
  const sp = await searchParams
  const tab: Tab = sp.tab && sp.tab in TABS ? (sp.tab as Tab) : 'work'
  const property = await prisma.property.findUniqueOrThrow({ where: { id: session.propertyId } })
  const today = todayISO(property.timezone)

  const [leads, counts, upcoming] = await Promise.all([
    prisma.lead.findMany({
      where: { propertyId: session.propertyId, status: { in: TABS[tab].statuses }, ...(tab === 'booked' ? { checkOut: { gte: toDate(today) } } : {}) },
      include,
      orderBy: tab === 'booked' ? { checkIn: 'asc' } : { createdAt: 'desc' },
      take: 100,
    }),
    prisma.lead.groupBy({ by: ['status'], where: { propertyId: session.propertyId }, _count: true }),
    prisma.lead.findMany({
      where: { propertyId: session.propertyId, status: 'booked', checkIn: { gte: toDate(today), lt: toDate(addDays(today, 7)) } },
      select: { estimate: true },
    }),
  ])

  const now = new Date()
  const count = (s: LeadStatus) => counts.find((c) => c.status === s)?._count ?? 0
  const newLeads = await prisma.lead.findMany({ where: { propertyId: session.propertyId, status: 'new' }, select: { createdAt: true } })
  const overdue = newLeads.filter((l) => minutesSince(l.createdAt, now) > property.callbackMinutes).length

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Заявки" sub={`Новым заявкам на сайте обещан ответ в течение ${property.callbackMinutes >= 60 ? `${property.callbackMinutes / 60} ч` : `${property.callbackMinutes} мин`}.`} />

      <div className="mb-10 grid grid-cols-2 gap-px overflow-hidden rounded-[18px] border border-line bg-line lg:grid-cols-4">
        <Stat label="Ждут ответа" value={count('new')} note={overdue ? `${overdue} ${plural(overdue, 'просрочена', 'просрочены', 'просрочено')}` : 'всё вовремя'} alert={overdue > 0} />
        <Stat label="Ждём задаток" value={count('contacted')} note="связались, даты не закреплены" />
        <Stat label="Заезды за неделю" value={upcoming.length} note={upcoming.length ? formatMoney(upcoming.reduce((s, l) => s + (l.estimate ?? 0), 0)) : 'пока нет'} />
        <Stat label="Подтверждено" value={count('booked')} note="предстоящих броней" />
      </div>

      <div className="mb-5 flex gap-1 border-b border-line">
        {(Object.keys(TABS) as Tab[]).map((t) => (
          <Link
            key={t}
            href={t === 'work' ? '/admin' : `/admin?tab=${t}`}
            aria-current={tab === t ? 'page' : undefined}
            className={`-mb-px border-b-2 px-4 pb-3 text-sm font-semibold transition-colors ${tab === t ? 'border-ink text-ink' : 'border-transparent text-ink-3 hover:text-ink'}`}
          >
            {TABS[t].label}
          </Link>
        ))}
      </div>

      {leads.length ? (
        <ul className="card divide-y divide-line overflow-hidden">
          {leads.map((l) => (
            <LeadRow key={l.id} lead={l} now={now} today={today} callbackMinutes={property.callbackMinutes} tab={tab} />
          ))}
        </ul>
      ) : (
        <div className="card px-6 py-16 text-center text-ink-3">Здесь пока пусто</div>
      )}
    </div>
  )
}

function Stat({ label, value, note, alert }: { label: string; value: number; note: string; alert?: boolean }) {
  return (
    <div className="bg-surface p-5">
      <div className="text-[13px] font-semibold text-ink-2">{label}</div>
      <div className="mt-2 text-[38px] leading-none font-semibold tracking-tight tabular-nums">{value}</div>
      <div className={`mt-1 text-[13px] ${alert ? 'font-semibold text-alert' : 'text-ink-3'}`}>{note}</div>
    </div>
  )
}

function LeadRow({ lead, now, today, callbackMinutes, tab }: { lead: Row; now: Date; today: string; callbackMinutes: number; tab: Tab }) {
  const late = lead.status === 'new' && minutesSince(lead.createdAt, now) > callbackMinutes
  const Via = VIA[lead.contactVia]
  const checkIn = toISO(lead.checkIn)
  const checkOut = toISO(lead.checkOut)
  const nights = daysBetween(checkIn, checkOut)
  const inDays = daysBetween(today, checkIn)

  return (
    <li>
      <Link href={`/admin/leads/${lead.id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2 px-5 py-4 transition-colors hover:bg-surface-2/60 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {lead.status === 'new' && <span className={`size-2 shrink-0 rounded-full ${late ? 'bg-alert' : 'bg-brass'}`} aria-hidden />}
            <span className="truncate font-semibold">{lead.name}</span>
            <Via size={13} className="shrink-0 text-ink-3" aria-label={lead.contactVia} />
          </div>
          <div className="truncate text-[13px] text-ink-3">{lead.occasion ?? 'Без повода'}</div>
        </div>

        <div className="order-3 col-span-2 text-sm sm:order-none sm:col-span-1">
          <div className="font-semibold">
            {formatRange(checkIn, checkOut)} <span className="font-normal text-ink-3">{weekdayShort(checkIn)}–{weekdayShort(checkOut)}</span>
          </div>
          <div className="text-[13px] text-ink-3">
            {nights} {plural(nights, 'ночь', 'ночи', 'ночей')}
            {tab === 'booked' && inDays >= 0 && ` · ${inDays === 0 ? 'заезд сегодня' : `через ${inDays} ${plural(inDays, 'день', 'дня', 'дней')}`}`}
          </div>
        </div>

        <div className="order-4 col-span-2 text-sm sm:order-none sm:col-span-1">
          <div>{lead.unit?.name ?? 'Дом не выбран'}</div>
          <div className="text-[13px] text-ink-3">
            {lead.guests} {plural(lead.guests, 'гость', 'гостя', 'гостей')}
            {lead.children > 0 && `, ${lead.children} дет.`}
          </div>
        </div>

        <div className="hidden text-right sm:block">
          <div className="font-semibold tabular-nums">{lead.estimate ? formatMoney(lead.estimate) : '—'}</div>
          {late ? (
            <div className="text-[13px] font-semibold text-alert">ждёт {ago(lead.createdAt, now).replace(' назад', '')}</div>
          ) : (
            <div className="text-[13px] text-ink-3">{tab === 'work' ? ago(lead.createdAt, now) : STATUS[lead.status].short}</div>
          )}
        </div>

        <ChevronRight size={18} className="text-ink-3" />
      </Link>
    </li>
  )
}
