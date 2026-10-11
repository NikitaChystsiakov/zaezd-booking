'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { quote } from '@/lib/quote'
import { toDate, formatRange } from '@/lib/dates'
import { toQuoteExtras, toQuoteRates, toQuoteUnit, CONTACT_VIA } from '@/lib/domain'
import { appUrl, escapeHtml, notifyTelegram } from '@/lib/notify'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const leadSchema = z.object({
  unitId: z.string().nullable(),
  checkIn: isoDate,
  checkOut: isoDate,
  guests: z.number().int().min(1).max(500),
  extraIds: z.array(z.string()).max(30),
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
export type LeadResult = { ok: true } | { ok: false; error: string }

export async function createLead(slug: string, input: LeadInput): Promise<LeadResult> {
  const parsed = leadSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Проверьте форму' }
  const data = parsed.data
  if (data.checkIn >= data.checkOut) return { ok: false, error: 'Выберите даты заезда и выезда' }

  const property = await prisma.property.findUnique({
    where: { slug },
    include: { extras: { where: { active: true } } },
  })
  if (!property) return { ok: false, error: 'Площадка не найдена' }

  const unit = data.unitId
    ? await prisma.unit.findFirst({ where: { id: data.unitId, propertyId: property.id, active: true }, include: { rates: true } })
    : null
  if (data.unitId && !unit) return { ok: false, error: 'Объект не найден' }

  const extraIds = data.extraIds.filter((id) => property.extras.some((e) => e.id === id))

  // Цену всегда пересчитываем на сервере: клиенту не доверяем
  const q = unit
    ? quote({
        unit: toQuoteUnit(unit),
        rates: toQuoteRates(unit.rates),
        extras: toQuoteExtras(property.extras),
        checkIn: data.checkIn,
        checkOut: data.checkOut,
        guests: data.guests,
        extraIds,
      })
    : null
  if (unit && q && data.guests > unit.capacity) return { ok: false, error: `${unit.name} вмещает до ${unit.capacity} гостей` }

  const lead = await prisma.lead.create({
    data: {
      propertyId: property.id,
      unitId: unit?.id ?? null,
      occasion: data.occasion,
      checkIn: toDate(data.checkIn),
      checkOut: toDate(data.checkOut),
      guests: data.guests,
      name: data.name,
      phone: data.phone,
      contactVia: data.contactVia,
      comment: data.comment || null,
      extraIds,
      quote: q ?? undefined,
      estimate: q?.ok ? q.total : null,
      events: { create: { type: 'created', text: 'Заявка с сайта' } },
    },
  })

  const extrasNames = property.extras.filter((e) => extraIds.includes(e.id)).map((e) => e.name)
  await notifyTelegram(
    property.telegramChatId,
    [
      `<b>Новая заявка · ${escapeHtml(data.occasion ?? 'без повода')}</b>`,
      `${escapeHtml(data.name)}, ${escapeHtml(data.phone)} — ${CONTACT_VIA[data.contactVia]}`,
      `${formatRange(data.checkIn, data.checkOut)}, ${data.guests} гостей, ${escapeHtml(unit?.name ?? 'объект не выбран')}`,
      extrasNames.length ? `Допы: ${escapeHtml(extrasNames.join(', '))}` : '',
      q?.ok ? `Расчёт: ${q.total} BYN` : '',
      data.comment ? `«${escapeHtml(data.comment)}»` : '',
      appUrl(`/admin/leads/${lead.id}`),
    ]
      .filter(Boolean)
      .join('\n'),
  )

  return { ok: true }
}
