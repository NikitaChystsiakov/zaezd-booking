import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft, CalendarDays, Lightbulb, MessageCircle, Phone, Send, TriangleAlert, Users } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'
import { findConflicts } from '@/lib/availability'
import { callHints } from '@/lib/callHints'
import { STATUS, ago, toQuoteExtras, toQuoteRates, toQuoteUnit, type ProposalOption } from '@/lib/domain'
import { daysBetween, formatDay, formatRange, plural, toISO } from '@/lib/dates'
import { formatMoney, quote, type Quote } from '@/lib/quote'
import { appUrl } from '@/lib/notify'
import { LeadStatusActions } from '@/components/admin/LeadStatusActions'
import { NoteForm } from '@/components/admin/NoteForm'
import { UnitPicker } from '@/components/admin/UnitPicker'
import { ProposalEditor } from '@/components/admin/ProposalEditor'
import { ContributionAdminRow } from '@/components/admin/ContributionAdminRow'
import { CopyButton } from '@/components/CopyButton'

export const metadata: Metadata = { title: 'Заявка' }

const EVENT_DOT: Record<string, string> = {
  created: 'bg-ink-3',
  status: 'bg-info',
  note: 'bg-ink-3',
  call: 'bg-ok',
  proposal_sent: 'bg-warn',
  proposal_viewed: 'bg-warn',
  proposal_accepted: 'bg-ok',
  contribution: 'bg-ok',
}

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireSession()
  const lead = await prisma.lead.findFirst({
    where: { id, propertyId: session.propertyId },
    include: {
      unit: { include: { rates: true } },
      property: { include: { units: { where: { active: true }, orderBy: { sortOrder: 'asc' }, include: { rates: true } }, extras: { where: { active: true }, orderBy: { sortOrder: 'asc' } } } },
      events: { orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true } } } },
      proposal: { include: { contributions: { orderBy: { createdAt: 'asc' } } } },
    },
  })
  if (!lead) notFound()

  const { property, unit, proposal } = lead
  const checkIn = toISO(lead.checkIn)
  const checkOut = toISO(lead.checkOut)
  const nights = daysBetween(checkIn, checkOut)
  const conflicts = unit ? await findConflicts(unit.id, lead.checkIn, lead.checkOut, lead.id) : []
  const hard = conflicts.filter((c) => c.kind !== 'request')
  const soft = conflicts.filter((c) => c.kind === 'request')
  const q = lead.quote as Quote | null
  const extrasById = Object.fromEntries(property.extras.map((e) => [e.id, e]))
  const hints = ['new', 'contacted'].includes(lead.status)
    ? callHints(lead, { baseGuests: unit?.baseGuests, conflicts, hasProposal: !!proposal })
    : []
  const phoneDigits = lead.phone.replace(/[^\d+]/g, '')

  // Варианты для нового КП: как просили / без допов / всё включено
  const allExtras = toQuoteExtras(property.extras)
  const priceFor = (extraIds: string[]) =>
    unit
      ? quote({ unit: toQuoteUnit(unit), rates: toQuoteRates(unit.rates), extras: allExtras, checkIn, checkOut, guests: lead.guests, extraIds }).total
      : 0
  const draftOptions: ProposalOption[] = proposal
    ? (proposal.options as ProposalOption[])
    : [
        { id: 'base', title: 'Только проживание', note: '', extraIds: [], price: priceFor([]) },
        { id: 'asked', title: 'Как вы просили', note: '', extraIds: lead.extraIds, price: priceFor(lead.extraIds) },
        { id: 'all', title: 'Всё включено', note: '', extraIds: allExtras.map((e) => e.id), price: priceFor(allExtras.map((e) => e.id)) },
      ].filter((o, i, arr) => arr.findIndex((x) => x.extraIds.join() === o.extraIds.join()) === i)

  const collected = proposal?.contributions.filter((c) => c.status === 'confirmed').reduce((s, c) => s + c.amount, 0) ?? 0
  const proposalUrl = proposal ? appUrl(`/o/${proposal.token}`) : null

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/admin" className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft size={15} /> Все заявки
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{lead.name}</h1>
            <span className={`chip ${STATUS[lead.status].tone}`}>{STATUS[lead.status].label}</span>
          </div>
          <p className="mt-1 text-ink-2">
            {lead.occasion ?? 'Без повода'} · заявка {ago(lead.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`tel:${phoneDigits}`} className="btn-ink">
            <Phone size={15} /> {lead.phone}
          </a>
          <a href={`https://t.me/${phoneDigits}`} target="_blank" className={`btn-ghost ${lead.contactVia === 'telegram' ? 'border-ink' : ''}`} aria-label="Написать в Telegram">
            <Send size={15} />
          </a>
          <a href={`viber://chat?number=${encodeURIComponent(phoneDigits)}`} className={`btn-ghost ${lead.contactVia === 'viber' ? 'border-ink' : ''}`} aria-label="Написать в Viber">
            <MessageCircle size={15} />
          </a>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Карточка звонка */}
          <section className="card p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-semibold">Карточка звонка</h2>
              <span className="text-xs text-ink-3">
                Гость просил: {lead.contactVia === 'call' ? 'позвонить' : `написать в ${lead.contactVia === 'telegram' ? 'Telegram' : 'Viber'}`}
              </span>
            </div>

            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
              <Fact icon={<CalendarDays size={15} />} label="Даты">
                {formatRange(checkIn, checkOut)}
                <span className="text-ink-3"> · {nights} {unit?.kind === 'venue' ? plural(nights, 'день', 'дня', 'дней') : plural(nights, 'ночь', 'ночи', 'ночей')}</span>
              </Fact>
              <Fact icon={<Users size={15} />} label="Гостей">
                {lead.guests}
                {unit && lead.guests > unit.baseGuests && unit.kind !== 'venue' && <span className="text-ink-3"> · {lead.guests - unit.baseGuests} сверх базы</span>}
              </Fact>
              <div>
                <dt className="mb-1 text-xs text-ink-3">Объект</dt>
                <dd>
                  <UnitPicker leadId={lead.id} value={lead.unitId} units={property.units.map((u) => ({ id: u.id, name: u.name, capacity: u.capacity }))} />
                </dd>
              </div>
            </dl>

            {lead.extraIds.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {lead.extraIds.map((id) => extrasById[id] && <span key={id} className="chip bg-surface-2 text-ink-2">{extrasById[id].name}</span>)}
              </div>
            )}

            {lead.comment && (
              <blockquote className="mt-4 border-l-2 border-line-strong pl-4 text-ink-2">«{lead.comment}»</blockquote>
            )}

            {hard.length > 0 && (
              <div className="mt-5 flex gap-3 rounded-lg bg-accent-soft p-4 text-sm text-accent">
                <TriangleAlert size={18} className="shrink-0" />
                <div>
                  <div className="font-medium">Даты пересекаются с занятыми</div>
                  {hard.map((c, i) => (
                    <div key={i}>
                      {formatRange(c.from, c.to)} — {c.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {soft.length > 0 && (
              <div className="mt-3 rounded-lg bg-warn-soft p-4 text-sm text-warn">
                <span className="font-medium">Ещё {soft.length} {plural(soft.length, 'заявка', 'заявки', 'заявок')} на эти даты: </span>
                {soft.map((c, i) => (
                  <Link key={i} href={`/admin/leads/${c.leadId}`} className="underline underline-offset-2">
                    {c.label}
                    {i < soft.length - 1 ? ', ' : ''}
                  </Link>
                ))}
              </div>
            )}

            {hints.length > 0 && (
              <div className="mt-5 rounded-lg border border-line p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Lightbulb size={15} className="text-warn" /> О чём сказать при звонке
                </div>
                <ul className="space-y-1.5 text-sm text-ink-2">
                  {hints.map((h) => (
                    <li key={h} className="flex gap-2">
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-ink-3" /> {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {q && q.ok && (
              <details className="mt-5 text-sm">
                <summary className="cursor-pointer text-ink-2 hover:text-ink">
                  Расчёт по заявке: <span className="font-semibold text-ink">{formatMoney(q.total)}</span>
                </summary>
                <dl className="mt-3 space-y-1">
                  {q.nights.map((n) => (
                    <div key={n.date} className="flex justify-between text-ink-2">
                      <dt>
                        {formatDay(n.date)} · {n.rate}
                        {n.extraGuests > 0 && ` + ${n.extraGuests} гост.`}
                      </dt>
                      <dd className="tabular-nums">{formatMoney(n.total)}</dd>
                    </div>
                  ))}
                  {q.extras.map((l) => (
                    <div key={l.id} className="flex justify-between text-ink-2">
                      <dt>
                        {l.name}
                        {l.qty > 1 && ` × ${l.qty}`}
                      </dt>
                      <dd className="tabular-nums">{formatMoney(l.total)}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
          </section>

          {/* КП и сбор предоплаты */}
          <section className="card p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Коммерческое предложение</h2>
              {proposal && (
                <span className="text-xs text-ink-3">
                  {proposal.views
                    ? `Открыто ${proposal.views} ${plural(proposal.views, 'раз', 'раза', 'раз')}, последний — ${ago(proposal.lastViewedAt!)}`
                    : 'Гость ещё не открывал'}
                </span>
              )}
            </div>

            {proposal && proposalUrl && (
              <div className="mb-5 space-y-4">
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-2 p-3">
                  <code className="min-w-0 flex-1 truncate text-sm">{proposalUrl}</code>
                  <CopyButton text={proposalUrl} />
                  <a className="btn-ghost btn-sm" target="_blank" href={`https://t.me/share/url?url=${encodeURIComponent(proposalUrl)}`}>Telegram</a>
                  <a className="btn-ghost btn-sm" href={`viber://forward?text=${encodeURIComponent(proposalUrl)}`}>Viber</a>
                  <a className="btn-ghost btn-sm" target="_blank" href={`/o/${proposal.token}?preview=1`}>Открыть</a>
                </div>

                {proposal.splitEnabled && (
                  <div>
                    <div className="mb-2 flex items-baseline justify-between text-sm">
                      <span className="font-medium">Скинуться компанией</span>
                      <span className="tabular-nums text-ink-2">
                        подтверждено {formatMoney(collected)} из {formatMoney(proposal.prepaymentAmount)}
                      </span>
                    </div>
                    <div className="mb-3 h-2 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-ok" style={{ width: `${Math.min(100, (collected / Math.max(1, proposal.prepaymentAmount)) * 100)}%` }} />
                    </div>
                    {proposal.contributions.length ? (
                      <ul className="divide-y divide-line rounded-lg border border-line">
                        {proposal.contributions.map((c) => (
                          <ContributionAdminRow key={c.id} id={c.id} name={c.name} amount={c.amount} status={c.status} />
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-ink-3">Пока никто не отметился.</p>
                    )}
                    {collected >= proposal.prepaymentAmount && lead.status !== 'booked' && (
                      <p className="mt-3 text-sm font-medium text-ok">Предоплата собрана — можно переводить в «Бронь».</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {unit ? (
              <ProposalEditor
                leadId={lead.id}
                hasProposal={!!proposal}
                extras={property.extras.map((e) => ({ id: e.id, name: e.name }))}
                initial={{
                  options: draftOptions,
                  chosenOptionId: proposal?.chosenOptionId ?? (draftOptions.find((o) => o.id === 'asked') ?? draftOptions[0]).id,
                  message:
                    proposal?.message ??
                    `${lead.name.split(' ')[0]}, добрый день! Как договорились — варианты на ${formatRange(checkIn, checkOut)}. Для брони дат нужна предоплата ${property.prepaymentPercent}%, её удобно собрать с компании по этой ссылке.`,
                  prepaymentPercent: property.prepaymentPercent,
                  prepaymentAmount: proposal?.prepaymentAmount ?? null,
                  splitEnabled: proposal?.splitEnabled ?? true,
                }}
              />
            ) : (
              <p className="text-sm text-ink-2">Выберите объект в карточке звонка — тогда соберём варианты с ценами.</p>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Следующий шаг</h2>
            <LeadStatusActions leadId={lead.id} status={lead.status} hasConflicts={hard.length > 0} />
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-semibold">История</h2>
            <NoteForm leadId={lead.id} />
            <ol className="mt-5 space-y-4">
              {lead.events.map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${EVENT_DOT[e.type] ?? 'bg-ink-3'}`} />
                  <div className="min-w-0">
                    <div className="whitespace-pre-wrap break-words">{e.text}</div>
                    <div className="mt-0.5 text-xs text-ink-3">
                      {e.type === 'call' ? 'Звонок · ' : ''}
                      {e.user?.name ?? 'Система'} · {ago(e.createdAt)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  )
}

function Fact({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="mb-1 flex items-center gap-1.5 text-xs text-ink-3">
        {icon} {label}
      </dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}
