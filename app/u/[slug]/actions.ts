'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { quote } from '@/lib/quote'
import { toDate, formatRange, todayISO } from '@/lib/dates'
import { findConflicts } from '@/lib/availability'
import { toQuoteExtras, toQuoteRates, toQuoteUnit, CONTACT_VIA } from '@/lib/domain'
import { appUrl, escapeHtml, notifyTelegram } from '@/lib/notify'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const leadSchema = z.object({
  unitId: z.string(),
  checkIn: isoDate,
  checkOut: isoDate,
  guests: z.number().int().min(1).max(200),
  children: z.number().int().min(0).max(100),
  picks: z.array(z.object({ id: z.string(), qty: z.number().int().min(1).max(100) })).max(40),
  occasion: z.string().max(80).nullable(),
  name: z.string().trim().min(2, 'Как к вам обращаться?').max(80),
  phone: z
    .string()
    .trim()
    .min(7, 'Проверьте номер телефона')
    .max(30)
    .regex(/^[+\d][\d\s()-]+$/, 'Проверьте номер телефона'),
  contactVia: z.enum(['call', 'telegram', 'viber']),
  comment: z.string().max(1000).optional(),
  // Ловушка для ботов: людям поле не видно
  website: z.string().max(0).optional(),
})

export type LeadInput = z.infer<typeof leadSchema>
export type LeadResult = { ok: true; total: number | null } | { ok: false; error: string }

export async function createLead(slug: string, input: LeadInput): Promise<LeadResult> {
  const parsed = leadSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Проверьте форму' }
  const data = parsed.data
  if (data.checkIn >= data.checkOut) return { ok: false, error: 'Выберите даты заезда и выезда' }

  const property = await prisma.property.findUnique({
    where: { slug },
    include: { extras: { where: { active: true } } },
  })
  if (!property) return { ok: false, error: 'Усадьба не найдена' }

  const today = todayISO(property.timezone)
  if (data.checkIn < today) return { ok: false, error: 'Дата заезда уже прошла' }

  const unit = await prisma.unit.findFirst({ where: { id: data.unitId, propertyId: property.id, active: true }, include: { rates: true } })
  if (!unit) return { ok: false, error: 'Дом не найден' }

  // Если гость видит занятость, не принимаем заявку на занятые даты. Если не видит — примем, администратор разберётся.
  if (property.showAvailability) {
    const busy = (await findConflicts(unit.id, toDate(data.checkIn), toDate(data.checkOut))).filter((c) => c.kind !== 'request')
    if (busy.length) return { ok: false, error: 'Эти даты уже заняты — выберите другие' }
  }

  // Цену всегда пересчитываем на сервере: клиенту не доверяем
  const picks = data.picks.filter((p) => property.extras.some((e) => e.id === p.id))
  const q = quote({
    unit: toQuoteUnit(unit),
    rates: toQuoteRates(unit.rates),
    extras: toQuoteExtras(property.extras),
    picks,
    checkIn: data.checkIn,
    checkOut: data.checkOut,
    guests: data.guests,
    holidays: property.holidays,
    today,
  })
  if (data.guests > unit.capacity) return { ok: false, error: `${unit.name} вмещает до ${unit.capacity} гостей` }

  const lead = await prisma.lead.create({
    data: {
      propertyId: property.id,
      unitId: unit.id,
      occasion: data.occasion,
      checkIn: toDate(data.checkIn),
      checkOut: toDate(data.checkOut),
      guests: data.guests,
      children: Math.min(data.children, data.guests),
      name: data.name,
      phone: data.phone,
      contactVia: data.contactVia,
      comment: data.comment || null,
      extras: picks,
      quote: q,
      estimate: q.ok ? q.total : null,
      events: { create: { type: 'created', text: 'Заявка с сайта' } },
    },
  })

  const extrasLine = q.extras.map((l) => (l.qty > 1 ? `${l.name} × ${l.qty}` : l.name)).join(', ')
  await notifyTelegram(
    property.telegramChatId,
    [
      `<b>Новая заявка · ${escapeHtml(unit.name)}</b>`,
      `${formatRange(data.checkIn, data.checkOut)}, ${data.guests} гостей${data.occasion ? ` · ${escapeHtml(data.occasion)}` : ''}`,
      `${escapeHtml(data.name)}, ${escapeHtml(data.phone)} — ${CONTACT_VIA[data.contactVia]}`,
      extrasLine ? `Услуги: ${escapeHtml(extrasLine)}` : '',
      q.ok ? `Расчёт: ${q.total} BYN` : '',
      data.comment ? `«${escapeHtml(data.comment)}»` : '',
      appUrl(`/admin/leads/${lead.id}`),
    ]
      .filter(Boolean)
      .join('\n'),
  )

  return { ok: true, total: q.ok ? q.total : null }
}
