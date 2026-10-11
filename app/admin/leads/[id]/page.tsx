import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft, MessageCircle, Phone, Send, TriangleAlert } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'
import { findConflicts } from '@/lib/availability'
import { STATUS, ago, CONTACT_VIA } from '@/lib/domain'
import { daysBetween, formatDay, formatRange, plural, toISO, weekdayShort } from '@/lib/dates'
import { depositFor, formatMoney, type Quote } from '@/lib/quote'
import { LeadStatusActions } from '@/components/admin/LeadStatusActions'
import { NoteForm } from '@/components/admin/NoteForm'

export const metadata: Metadata = { title: 'Заявка' }

const DOT: Record<string, string> = { created: 'bg-ink-3', status: 'bg-ok', note: 'bg-ink-3', call: 'bg-brass' }

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireSession()
  const lead = await prisma.lead.findFirst({
    where: { id, propertyId: session.propertyId },
    include: {
      unit: { select: { id: true, name: true, photos: true } },
      property: { select: { depositPercent: true } },
      events: { orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true } } } },
    },
  })
  if (!lead) notFound()

  const checkIn = toISO(lead.checkIn)
  const checkOut = toISO(lead.checkOut)
  const nights = daysBetween(checkIn, checkOut)
  const conflicts = lead.unit ? await findConflicts(lead.unit.id, lead.checkIn, lead.checkOut, lead.id) : []
  const hard = conflicts.filter((c) => c.kind !== 'request')
  const soft = conflicts.filter((c) => c.kind === 'request')
  const q = lead.quote as Quote | null
  const phone = lead.phone.replace(/[^\d+]/g, '')

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/admin" className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft size={15} /> Заявки
      </Link>

      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <span className={`chip ${STATUS[lead.status].tone}`}>{STATUS[lead.status].label}</span>
          <h1 className="display mt-3 text-[44px] sm:text-[52px]">{lead.name}</h1>
          <p className="mt-1 text-ink-2">
            {lead.occasion ?? 'Без повода'} · заявка {ago(lead.createdAt)} · просит связаться: {CONTACT_VIA[lead.contactVia]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`tel:${phone}`} className="btn-primary">
            <Phone size={15} /> {lead.phone}
          </a>
          <a href={`https://t.me/${phone}`} target="_blank" rel="noreferrer" className="btn-ghost size-10 px-0" aria-label="Написать в Telegram">
            <Send size={15} />
          </a>
          <a href={`viber://chat?number=${encodeURIComponent(phone)}`} className="btn-ghost size-10 px-0" aria-label="Написать в Viber">
            <MessageCircle size={15} />
          </a>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <section className="card overflow-hidden">
            <div className="grid sm:grid-cols-[200px_1fr]">
              {lead.unit?.photos[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={lead.unit.photos[0]} alt="" className="photo-grade h-40 w-full object-cover sm:h-full" />
              )}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-5 p-6 sm:grid-cols-3">
                <Fact label="Дом">{lead.unit?.name ?? 'не выбран'}</Fact>
                <Fact label="Заезд">
                  {formatDay(checkIn)}, {weekdayShort(checkIn)}
                </Fact>
                <Fact label="Выезд">
                  {formatDay(checkOut)}, {weekdayShort(checkOut)}
                </Fact>
                <Fact label="Ночей">{nights}</Fact>
                <Fact label="Гостей">
                  {lead.guests}
                  {lead.children > 0 && <span className="font-normal text-ink-3">, из них {lead.children} дет.</span>}
                </Fact>
                <Fact label="Источник">сайт</Fact>
              </dl>
            </div>
            {lead.comment && (
              <blockquote className="border-t border-line px-6 py-5 text-[15px] leading-relaxed text-ink-2">
                <span className="display mr-1 text-2xl text-brass">«</span>
                {lead.comment}
              </blockquote>
            )}
          </section>

          {hard.length > 0 && (
            <div className="flex gap-3 rounded-[18px] border border-alert/30 bg-alert-soft p-5 text-sm text-alert">
              <TriangleAlert size={18} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-bold">Даты пересекаются с занятыми</div>
                {hard.map((c, i) => (
                  <div key={i} className="mt-1">
                    {formatRange(c.from, c.to)} — {c.label}
                  </div>
                ))}
                <div className="mt-2 text-alert/80">Предложите гостю другие даты или второй дом — подтвердить эту бронь система не даст.</div>
              </div>
            </div>
          )}
          {soft.length > 0 && (
            <div className="rounded-[18px] border border-warn/30 bg-warn-soft p-5 text-sm text-warn">
              <span className="font-bold">
                На эти даты ещё {soft.length} {plural(soft.length, 'заявка', 'заявки', 'заявок')}:{' '}
              </span>
              {soft.map((c, i) => (
                <Link key={i} href={`/admin/leads/${c.leadId}`} className="underline underline-offset-2">
                  {c.label}
                  {i < soft.length - 1 ? ', ' : ''}
                </Link>
              ))}
              . Кто первым внесёт задаток — того и даты.
            </div>
          )}

          {q && (
            <section className="card p-6">
              <h2 className="text-[17px] font-bold">Расчёт на момент заявки</h2>
              <dl className="mt-4 space-y-2 text-[15px]">
                {q.nights.map((n) => (
                  <div key={n.date} className="flex justify-between gap-4">
                    <dt className="text-ink-2">
                      {formatDay(n.date)}, {weekdayShort(n.date)} · {n.rate}
                      {n.extraGuests > 0 && <span className="text-ink-3"> · +{n.extraGuests} гост.</span>}
                      {n.discount > 0 && <span className="text-ok"> · −{n.discount}</span>}
                    </dt>
                    <dd className="tabular-nums">{formatMoney(n.total)}</dd>
                  </div>
                ))}
                {q.extras.length > 0 && <div className="pt-2" />}
                {q.extras.map((l) => (
                  <div key={l.id} className="flex justify-between gap-4">
                    <dt className="text-ink-2">
                      {l.name}
                      {l.qty > 1 && ` × ${l.qty}`}
                    </dt>
                    <dd className="tabular-nums">{formatMoney(l.total)}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5 flex flex-wrap items-baseline justify-between gap-3 border-t border-line pt-5">
                <span className="font-bold">Итого</span>
                <span className="text-[30px] font-semibold tracking-tight tabular-nums">{formatMoney(q.total)}</span>
              </div>
              <div className="flex justify-between text-sm text-ink-2">
                <span>Задаток {lead.property.depositPercent}%</span>
                <span className="tabular-nums">{formatMoney(depositFor(q.total, lead.property.depositPercent))}</span>
              </div>
              {!q.ok && <p className="mt-3 text-sm text-alert">{q.errors.join('. ')}</p>}
            </section>
          )}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-8">
          <section className="card p-6">
            <h2 className="mb-4 text-[17px] font-bold">Что дальше</h2>
            <LeadStatusActions leadId={lead.id} status={lead.status} hasConflicts={hard.length > 0} />
          </section>

          <section className="card p-6">
            <h2 className="mb-4 text-[17px] font-bold">История</h2>
            <NoteForm leadId={lead.id} />
            <ol className="mt-6 space-y-5">
              {lead.events.map((e) => (
                <li key={e.id} className="relative flex gap-3 text-sm">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${DOT[e.type] ?? 'bg-ink-3'}`} />
                  <div className="min-w-0">
                    <div className="leading-relaxed break-words whitespace-pre-wrap">{e.text}</div>
                    <div className="mt-0.5 text-xs text-ink-3">
                      {e.type === 'call' ? 'Звонок · ' : ''}
                      {e.user?.name ?? 'Сайт'} · {ago(e.createdAt)}
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

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-ink-3">{label}</dt>
      <dd className="mt-1 font-semibold">{children}</dd>
    </div>
  )
}
