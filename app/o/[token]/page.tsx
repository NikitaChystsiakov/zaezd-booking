import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CalendarDays, MapPin, Phone, Users } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { daysBetween, formatRange, plural, toISO } from '@/lib/dates'
import type { ProposalOption } from '@/lib/domain'
import { ProposalOptions } from '@/components/proposal/ProposalOptions'
import { SplitPanel } from '@/components/proposal/SplitPanel'

type Params = { params: Promise<{ token: string }>; searchParams: Promise<{ preview?: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { token } = await params
  const p = await prisma.proposal.findUnique({ where: { token }, select: { lead: { select: { property: { select: { name: true } } } } } })
  return p ? { title: `Предложение — ${p.lead.property.name}`, robots: { index: false } } : {}
}

export default async function ProposalPage({ params, searchParams }: Params) {
  const { token } = await params
  const { preview } = await searchParams
  const proposal = await prisma.proposal.findUnique({
    where: { token },
    include: {
      lead: { include: { unit: true, property: { include: { extras: true } } } },
      contributions: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!proposal) notFound()

  // Админ, открывший превью, не должен «греть» заявку
  if (!preview) {
    await prisma.proposal.update({ where: { id: proposal.id }, data: { views: { increment: 1 }, lastViewedAt: new Date() } })
    // Не засоряем историю: одно событие просмотра в час
    const recent = await prisma.leadEvent.findFirst({
      where: { leadId: proposal.leadId, type: 'proposal_viewed', createdAt: { gt: new Date(Date.now() - 3_600_000) } },
    })
    if (!recent) {
      await prisma.leadEvent.create({ data: { leadId: proposal.leadId, type: 'proposal_viewed', text: 'Гость открыл КП' } })
    }
  }

  const { lead } = proposal
  const { property, unit } = lead
  const checkIn = toISO(lead.checkIn)
  const checkOut = toISO(lead.checkOut)
  const nights = daysBetween(checkIn, checkOut)
  const options = proposal.options as ProposalOption[]
  const extrasById = Object.fromEntries(property.extras.map((e) => [e.id, { name: e.name, description: e.description }]))
  const booked = lead.status === 'booked' || lead.status === 'done'

  return (
    <div className="min-h-dvh bg-[#f3efe6] text-[#1f2622] [--paper:#f3efe6] [--surface:#fffdf8] [--surface-2:#ece6da] [--line:#ddd5c5] [--line-strong:#c9bfac] [--ink:#1f2622] [--ink-2:#4e564f] [--ink-3:#858a80] [--accent:#1f5f6b] [--accent-soft:#d9e7e6] [--accent-ink:#ffffff] [--ok:#2f7a4b] [--ok-soft:#dfece2] [--warn:#99600f] [--warn-soft:#f3e6cf] [color-scheme:light]">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <div className="eyebrow mb-3">Предложение для {lead.name.split(' ')[0]}</div>
        <h1 className="font-serif text-4xl leading-tight sm:text-5xl">{property.name}</h1>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
          <span className="flex items-center gap-1.5">
            <CalendarDays size={15} /> {formatRange(checkIn, checkOut)} · {nights} {unit?.kind === 'venue' ? plural(nights, 'день', 'дня', 'дней') : plural(nights, 'ночь', 'ночи', 'ночей')}
          </span>
          <span className="flex items-center gap-1.5">
            <Users size={15} /> {lead.guests} {plural(lead.guests, 'гость', 'гостя', 'гостей')}
          </span>
          {unit && <span>{unit.name}</span>}
          {property.address && (
            <span className="flex items-center gap-1.5">
              <MapPin size={15} /> {property.address}
            </span>
          )}
        </div>

        {proposal.message && (
          <div className="card mt-8 whitespace-pre-wrap p-5 leading-relaxed text-ink-2">{proposal.message}</div>
        )}

        {unit?.photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={unit.photo} alt="" className="mt-8 aspect-[2/1] w-full rounded-xl object-cover" />
        )}

        <h2 className="mb-4 mt-12 font-serif text-2xl">Варианты</h2>
        <ProposalOptions
          token={token}
          options={options}
          chosenOptionId={proposal.chosenOptionId}
          accepted={!!proposal.acceptedAt}
          booked={booked}
          extras={extrasById}
        />

        {booked ? (
          <div className="card mt-12 p-6 text-center">
            <div className="font-serif text-2xl">Бронь подтверждена</div>
            <p className="mt-2 text-ink-2">Ждём вас {formatRange(checkIn, checkOut)}. Заезд с {property.checkInTime}, выезд до {property.checkOutTime}.</p>
          </div>
        ) : (
          <>
            <h2 className="mb-2 mt-12 font-serif text-2xl">Предоплата {proposal.prepaymentAmount} BYN</h2>
            <p className="mb-5 text-ink-2">Даты закрепляются за вами после предоплаты. Остаток — при заезде.</p>
            {proposal.splitEnabled ? (
              <SplitPanel
                token={token}
                target={proposal.prepaymentAmount}
                guests={lead.guests}
                paymentDetails={property.paymentDetails}
                contributions={proposal.contributions.map((c) => ({ id: c.id, name: c.name, amount: c.amount, status: c.status }))}
              />
            ) : (
              property.paymentDetails && <div className="card whitespace-pre-wrap p-5 text-sm">{property.paymentDetails}</div>
            )}
          </>
        )}

        <footer className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-sm text-ink-2">
          <span>Остались вопросы — позвоните, обсудим.</span>
          {property.phone && (
            <a href={`tel:${property.phone.replace(/\s/g, '')}`} className="btn-ghost">
              <Phone size={15} /> {property.phone}
            </a>
          )}
        </footer>
      </div>
    </div>
  )
}
