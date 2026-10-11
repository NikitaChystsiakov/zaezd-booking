'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { LeadStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'
import { findConflicts, isDoubleBookingError } from '@/lib/availability'
import { quote } from '@/lib/quote'
import { parseIcal } from '@/lib/ical'
import { toDate, toISO } from '@/lib/dates'
import { STATUS, toQuoteExtras, toQuoteRates, toQuoteUnit, type ProposalOption } from '@/lib/domain'

export type ActionResult = { ok: true } | { ok: false; error: string }

/** Заявка именно этой площадки — иначе 404. Защита от чужих id в запросе. */
async function ownLead(leadId: string) {
  const session = await requireSession()
  const lead = await prisma.lead.findFirst({ where: { id: leadId, propertyId: session.propertyId } })
  if (!lead) redirect('/admin')
  return { session, lead }
}

export async function setLeadStatus(leadId: string, status: LeadStatus): Promise<ActionResult> {
  const { session, lead } = await ownLead(leadId)
  if (lead.status === status) return { ok: true }

  if (status === 'booked' && lead.unitId) {
    const hard = (await findConflicts(lead.unitId, lead.checkIn, lead.checkOut, lead.id)).filter((c) => c.kind !== 'request')
    if (hard.length) return { ok: false, error: `Даты уже заняты: ${hard[0].label}` }
  }
  if (status === 'booked' && !lead.unitId) return { ok: false, error: 'Сначала выберите объект для заявки' }

  try {
    await prisma.$transaction([
      prisma.lead.update({
        where: { id: lead.id },
        data: { status, contactedAt: lead.contactedAt ?? (status !== 'new' ? new Date() : null) },
      }),
      prisma.leadEvent.create({
        data: { leadId: lead.id, userId: session.userId, type: 'status', text: `Статус: ${STATUS[status].short}` },
      }),
    ])
  } catch (e) {
    // Последняя линия обороны — ограничение в Postgres, если две брони подтверждают одновременно
    if (isDoubleBookingError(e)) return { ok: false, error: 'Эти даты только что занял другой заезд' }
    throw e
  }
  revalidatePath('/admin', 'layout')
  return { ok: true }
}

export async function addLeadNote(leadId: string, text: string, kind: 'note' | 'call'): Promise<ActionResult> {
  const { session, lead } = await ownLead(leadId)
  const clean = text.trim().slice(0, 2000)
  if (!clean) return { ok: false, error: 'Пустая заметка' }
  await prisma.leadEvent.create({ data: { leadId: lead.id, userId: session.userId, type: kind, text: clean } })
  // Первый звонок по новой заявке сам двигает её дальше
  if (kind === 'call' && lead.status === 'new') {
    await prisma.lead.update({ where: { id: lead.id }, data: { status: 'contacted', contactedAt: new Date() } })
  }
  revalidatePath('/admin', 'layout')
  return { ok: true }
}

export async function setLeadUnit(leadId: string, unitId: string): Promise<ActionResult> {
  const { session, lead } = await ownLead(leadId)
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, propertyId: session.propertyId },
    include: { rates: true, property: { include: { extras: true } } },
  })
  if (!unit) return { ok: false, error: 'Объект не найден' }
  const q = quote({
    unit: toQuoteUnit(unit),
    rates: toQuoteRates(unit.rates),
    extras: toQuoteExtras(unit.property.extras),
    checkIn: toISO(lead.checkIn),
    checkOut: toISO(lead.checkOut),
    guests: lead.guests,
    extraIds: lead.extraIds,
  })
  await prisma.lead.update({ where: { id: lead.id }, data: { unitId: unit.id, quote: q, estimate: q.ok ? q.total : null } })
  await prisma.leadEvent.create({ data: { leadId: lead.id, userId: session.userId, type: 'note', text: `Объект: ${unit.name}` } })
  revalidatePath('/admin', 'layout')
  return { ok: true }
}

const optionSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(1).max(80),
  note: z.string().max(300).optional(),
  price: z.number().int().min(0),
  extraIds: z.array(z.string()),
})

export async function saveProposal(
  leadId: string,
  input: { options: ProposalOption[]; chosenOptionId: string | null; message: string; prepaymentAmount: number; splitEnabled: boolean },
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const { session, lead } = await ownLead(leadId)
  const options = z.array(optionSchema).min(1).max(4).safeParse(input.options)
  if (!options.success) return { ok: false, error: 'Проверьте варианты: у каждого нужно название и цена' }
  const prepaymentAmount = Math.max(0, Math.round(input.prepaymentAmount))

  const data = {
    options: options.data,
    chosenOptionId: input.chosenOptionId,
    message: input.message.slice(0, 2000) || null,
    prepaymentAmount,
    splitEnabled: input.splitEnabled,
  }
  const existing = await prisma.proposal.findUnique({ where: { leadId: lead.id } })
  const proposal = existing
    ? await prisma.proposal.update({ where: { id: existing.id }, data })
    : await prisma.proposal.create({ data: { ...data, leadId: lead.id } })

  await prisma.leadEvent.create({
    data: { leadId: lead.id, userId: session.userId, type: 'proposal_sent', text: existing ? 'КП обновлено' : 'КП создано' },
  })
  if (lead.status === 'new' || lead.status === 'contacted') {
    await prisma.lead.update({ where: { id: lead.id }, data: { status: 'proposal', contactedAt: lead.contactedAt ?? new Date() } })
  }
  revalidatePath('/admin', 'layout')
  return { ok: true, token: proposal.token }
}

export async function confirmContribution(contributionId: string, confirmed: boolean): Promise<ActionResult> {
  const session = await requireSession()
  const c = await prisma.contribution.findFirst({
    where: { id: contributionId, proposal: { lead: { propertyId: session.propertyId } } },
    include: { proposal: true },
  })
  if (!c) return { ok: false, error: 'Не найдено' }
  await prisma.contribution.update({
    where: { id: c.id },
    data: confirmed ? { status: 'confirmed', confirmedAt: new Date() } : { status: 'marked_paid', confirmedAt: null },
  })
  await prisma.leadEvent.create({
    data: {
      leadId: c.proposal.leadId,
      userId: session.userId,
      type: 'contribution',
      text: confirmed ? `Подтверждён перевод: ${c.name}, ${c.amount} BYN` : `Снято подтверждение: ${c.name}`,
    },
  })
  revalidatePath('/admin', 'layout')
  return { ok: true }
}

// ───────── Настройки ─────────

const settingsSchema = z.object({
  showAvailability: z.boolean(),
  priceMode: z.enum(['exact', 'from', 'hidden']),
  prepaymentPercent: z.number().int().min(0).max(100),
  callbackMinutes: z.number().int().min(5).max(24 * 60),
  paymentDetails: z.string().max(1000),
  telegramChatId: z.string().max(40),
})

export async function saveSettings(input: z.infer<typeof settingsSchema>): Promise<ActionResult> {
  const session = await requireSession()
  const parsed = settingsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Проверьте значения' }
  await prisma.property.update({
    where: { id: session.propertyId },
    data: { ...parsed.data, paymentDetails: parsed.data.paymentDetails || null, telegramChatId: parsed.data.telegramChatId || null },
  })
  revalidatePath('/', 'layout')
  return { ok: true }
}

// ───────── Цены и услуги ─────────

export async function updateRate(rateId: string, pricePerNight: number, extraGuestPrice: number): Promise<ActionResult> {
  const session = await requireSession()
  const rate = await prisma.rate.findFirst({ where: { id: rateId, unit: { propertyId: session.propertyId } } })
  if (!rate) return { ok: false, error: 'Не найдено' }
  if (!(pricePerNight >= 0 && extraGuestPrice >= 0)) return { ok: false, error: 'Цена не может быть отрицательной' }
  await prisma.rate.update({ where: { id: rate.id }, data: { pricePerNight: Math.round(pricePerNight), extraGuestPrice: Math.round(extraGuestPrice) } })
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function updateExtra(extraId: string, price: number, active: boolean): Promise<ActionResult> {
  const session = await requireSession()
  const extra = await prisma.extra.findFirst({ where: { id: extraId, propertyId: session.propertyId } })
  if (!extra) return { ok: false, error: 'Не найдено' }
  if (!(price >= 0)) return { ok: false, error: 'Цена не может быть отрицательной' }
  await prisma.extra.update({ where: { id: extra.id }, data: { price: Math.round(price), active } })
  revalidatePath('/', 'layout')
  return { ok: true }
}

// ───────── Календарь: блокировки и внешние ленты ─────────

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export async function addBlock(unitId: string, start: string, end: string, reason: string): Promise<ActionResult> {
  const session = await requireSession()
  const unit = await prisma.unit.findFirst({ where: { id: unitId, propertyId: session.propertyId } })
  if (!unit) return { ok: false, error: 'Объект не найден' }
  if (!isoDate.safeParse(start).success || !isoDate.safeParse(end).success || start >= end) {
    return { ok: false, error: 'Проверьте даты' }
  }
  await prisma.block.create({ data: { unitId: unit.id, start: toDate(start), end: toDate(end), reason: reason.trim().slice(0, 120) || 'Закрыто' } })
  revalidatePath('/admin', 'layout')
  return { ok: true }
}

export async function deleteBlock(blockId: string): Promise<ActionResult> {
  const session = await requireSession()
  const block = await prisma.block.findFirst({ where: { id: blockId, unit: { propertyId: session.propertyId }, feedId: null } })
  if (!block) return { ok: false, error: 'Блокировки из внешних календарей снимаются там, откуда пришли' }
  await prisma.block.delete({ where: { id: block.id } })
  revalidatePath('/admin', 'layout')
  return { ok: true }
}

export async function addFeed(unitId: string, label: string, url: string): Promise<ActionResult> {
  const session = await requireSession()
  const unit = await prisma.unit.findFirst({ where: { id: unitId, propertyId: session.propertyId } })
  if (!unit) return { ok: false, error: 'Объект не найден' }
  if (!z.url({ protocol: /^https?$/ }).safeParse(url.trim()).success) return { ok: false, error: 'Нужна ссылка вида https://…' }
  const feed = await prisma.calendarFeed.create({ data: { unitId: unit.id, label: label.trim().slice(0, 40) || 'Календарь', url: url.trim() } })
  const res = await syncFeed(feed.id)
  revalidatePath('/admin', 'layout')
  return res
}

export async function removeFeed(feedId: string): Promise<ActionResult> {
  const session = await requireSession()
  const feed = await prisma.calendarFeed.findFirst({ where: { id: feedId, unit: { propertyId: session.propertyId } } })
  if (!feed) return { ok: false, error: 'Не найдено' }
  await prisma.calendarFeed.delete({ where: { id: feed.id } })
  revalidatePath('/admin', 'layout')
  return { ok: true }
}

/** Подтянуть занятость из внешней ленты: старые блокировки этой ленты заменяются новыми */
export async function syncFeed(feedId: string): Promise<ActionResult> {
  const session = await requireSession()
  const feed = await prisma.calendarFeed.findFirst({ where: { id: feedId, unit: { propertyId: session.propertyId } } })
  if (!feed) return { ok: false, error: 'Не найдено' }

  let text: string
  try {
    // Не даём через ленту достучаться до внутренних адресов сервера
    const host = new URL(feed.url).hostname
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|0\.)/.test(host)) {
      throw new Error('внутренние адреса запрещены')
    }
    const res = await fetch(feed.url, { signal: AbortSignal.timeout(8000), headers: { accept: 'text/calendar' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    text = await res.text()
    if (!text.includes('BEGIN:VCALENDAR')) throw new Error('это не iCal-календарь')
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'ошибка'
    await prisma.calendarFeed.update({ where: { id: feed.id }, data: { lastError: `Не удалось загрузить: ${msg}` } })
    revalidatePath('/admin', 'layout')
    return { ok: false, error: `Не удалось загрузить календарь: ${msg}` }
  }

  const events = parseIcal(text)
  await prisma.$transaction([
    prisma.block.deleteMany({ where: { feedId: feed.id } }),
    prisma.block.createMany({
      data: events.map((e) => ({
        unitId: feed.unitId,
        feedId: feed.id,
        externalId: e.uid,
        start: toDate(e.start),
        end: toDate(e.end),
        reason: e.summary || `Бронь в «${feed.label}»`,
      })),
      skipDuplicates: true,
    }),
    prisma.calendarFeed.update({ where: { id: feed.id }, data: { lastSyncAt: new Date(), lastError: null } }),
  ])
  revalidatePath('/admin', 'layout')
  return { ok: true }
}
