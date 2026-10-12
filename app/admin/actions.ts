'use server'

import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { LeadStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/session'
import type { Permission } from '@/lib/permissions'
import { isDoubleBookingError } from '@/lib/availability'
import { parseIcal } from '@/lib/ical'
import { toDate } from '@/lib/dates'
import { STATUS } from '@/lib/domain'
import { UPLOAD_DIR } from '@/lib/uploads'
import { fetchPublicText } from '@/lib/safeFetch'

export type ActionResult = { ok: true } | { ok: false; error: string }

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

function refresh() {
  revalidatePath('/', 'layout')
}

/** Запись именно этой усадьбы — иначе на список. Защита от чужих id в запросе. */
async function ownLead(leadId: string, permission: Permission = 'leads:write') {
  const session = await requirePermission(permission)
  const lead = await prisma.lead.findFirst({ where: { id: leadId, propertyId: session.propertyId } })
  if (!lead) redirect('/admin')
  return { session, lead }
}

async function ownUnit(unitId: string, permission: Permission = 'units:write') {
  const session = await requirePermission(permission)
  const unit = await prisma.unit.findFirst({ where: { id: unitId, propertyId: session.propertyId } })
  if (!unit) redirect('/admin/units')
  return { session, unit }
}

// ───────── Заявки ─────────

export async function setLeadStatus(leadId: string, status: LeadStatus): Promise<ActionResult> {
  const { session, lead } = await ownLead(leadId)
  if (lead.status === status) return { ok: true }

  const occupies = (s: LeadStatus) => s === 'booked' || s === 'done'

  try {
    const conflict = await prisma.$transaction(async (tx) => {
      if (occupies(status) && lead.unitId) {
        // Подтверждения по одному дому — строго по очереди: второй администратор дождётся первого
        // и увидит занятые даты. Без очереди две транзакции упираются друг в друга (deadlock).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lead.unitId}))`
        const [booked, block] = await Promise.all([
          tx.lead.findFirst({
            where: { unitId: lead.unitId, id: { not: lead.id }, status: { in: ['booked', 'done'] }, checkIn: { lt: lead.checkOut }, checkOut: { gt: lead.checkIn } },
            select: { name: true },
          }),
          tx.block.findFirst({
            where: { unitId: lead.unitId, start: { lt: lead.checkOut }, end: { gt: lead.checkIn } },
            select: { reason: true, feed: { select: { label: true } } },
          }),
        ])
        if (booked) return booked.name
        if (block) return block.feed ? `занято в «${block.feed.label}»` : (block.reason ?? 'даты закрыты')
      }
      await tx.lead.update({ where: { id: lead.id }, data: { status, contactedAt: lead.contactedAt ?? (status !== 'new' ? new Date() : null) } })
      await tx.leadEvent.create({ data: { leadId: lead.id, userId: session.userId, type: 'status', text: STATUS[status].label } })
      return null
    })
    if (conflict) return { ok: false, error: `Даты уже заняты: ${conflict}` }
  } catch (e) {
    // Последняя линия обороны — ограничение в Postgres
    if (isDoubleBookingError(e)) return { ok: false, error: 'Эти даты только что занял другой заезд' }
    throw e
  }
  refresh()
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
  refresh()
  return { ok: true }
}

// ───────── Дома ─────────

const unitSchema = z.object({
  name: z.string().trim().min(2, 'Название — хотя бы 2 буквы').max(60),
  summary: z.string().trim().max(120),
  description: z.string().trim().max(3000),
  capacity: z.number().int().min(1, 'Вместимость — хотя бы 1 гость').max(500),
  amenities: z.array(z.string().trim().min(1).max(60)).max(20),
  longStayFromNight: z.number().int().min(2).max(60).nullable(),
  longStayPercent: z.number().int().min(0).max(90),
  active: z.boolean(),
})

export type UnitInput = z.infer<typeof unitSchema>

function slugify(name: string): string {
  const map: Record<string, string> = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya' }
  return (
    name
      .toLowerCase()
      .replace(/^дом\s+/, '')
      .split('')
      .map((c) => map[c] ?? c)
      .join('')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'dom'
  )
}

export async function createUnit(name: string, capacity: number): Promise<{ ok: false; error: string } | never> {
  const session = await requirePermission('units:write')
  const parsed = unitSchema.pick({ name: true, capacity: true }).safeParse({ name, capacity })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const count = await prisma.unit.count({ where: { propertyId: session.propertyId } })
  let slug = slugify(parsed.data.name)
  if (await prisma.unit.findFirst({ where: { propertyId: session.propertyId, slug } })) slug = `${slug}-${count + 1}`
  const unit = await prisma.unit.create({
    data: {
      propertyId: session.propertyId,
      name: parsed.data.name,
      slug,
      capacity: parsed.data.capacity,
      sortOrder: count,
      active: false,
      // Стартовый тариф, чтобы расчёт сразу работал — владелец поправит
      rates: { create: { name: 'Любой день', weekdays: [], includedGuests: parsed.data.capacity, pricePerNight: 0 } },
    },
  })
  refresh()
  redirect(`/admin/units/${unit.id}`)
}

export async function saveUnit(unitId: string, input: UnitInput): Promise<ActionResult> {
  const { unit } = await ownUnit(unitId)
  const parsed = unitSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  await prisma.unit.update({ where: { id: unit.id }, data: { ...parsed.data, summary: parsed.data.summary || null, description: parsed.data.description || null } })
  refresh()
  return { ok: true }
}

export async function deleteUnit(unitId: string): Promise<ActionResult> {
  const { unit } = await ownUnit(unitId, 'units:delete')
  const bookings = await prisma.lead.count({ where: { unitId: unit.id, status: { in: ['booked', 'new', 'contacted'] } } })
  if (bookings) return { ok: false, error: 'По дому есть заявки и брони — сначала закройте их или просто скройте дом с сайта' }
  await prisma.unit.delete({ where: { id: unit.id } })
  refresh()
  redirect('/admin/units')
}

// ───────── Тарифы ─────────

const rateSchema = z
  .object({
    name: z.string().trim().min(1, 'Назовите тариф').max(60),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7),
    holidaysOnly: z.boolean(),
    startDate: isoDate.nullable(),
    endDate: isoDate.nullable(),
    minGuests: z.number().int().min(1).max(500),
    maxGuests: z.number().int().min(1).max(500).nullable(),
    includedGuests: z.number().int().min(1, 'В цену входит хотя бы 1 гость').max(500),
    pricePerNight: z.number().int().min(0, 'Цена не может быть отрицательной').max(1_000_000),
    extraGuestPrice: z.number().int().min(0).max(100_000),
    bookableWithinDays: z.number().int().min(1).max(730).nullable(),
    priority: z.number().int().min(0).max(1000),
  })
  .refine((r) => r.maxGuests === null || r.maxGuests >= r.minGuests, 'Гостей «до» меньше, чем «от»')
  .refine((r) => !r.startDate || !r.endDate || r.startDate <= r.endDate, 'Период: дата окончания раньше начала')

export type RateInput = z.infer<typeof rateSchema>

export async function saveRate(unitId: string, rateId: string | null, input: RateInput): Promise<ActionResult> {
  const { unit } = await ownUnit(unitId)
  const parsed = rateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const data = {
    ...parsed.data,
    weekdays: [...new Set(parsed.data.weekdays)].sort(),
    startDate: parsed.data.startDate ? toDate(parsed.data.startDate) : null,
    endDate: parsed.data.endDate ? toDate(parsed.data.endDate) : null,
  }
  if (rateId) {
    const rate = await prisma.rate.findFirst({ where: { id: rateId, unitId: unit.id } })
    if (!rate) return { ok: false, error: 'Тариф не найден' }
    await prisma.rate.update({ where: { id: rate.id }, data })
  } else {
    const count = await prisma.rate.count({ where: { unitId: unit.id } })
    await prisma.rate.create({ data: { ...data, unitId: unit.id, sortOrder: count } })
  }
  refresh()
  return { ok: true }
}

export async function deleteRate(unitId: string, rateId: string): Promise<ActionResult> {
  const { unit } = await ownUnit(unitId, 'units:delete')
  const total = await prisma.rate.count({ where: { unitId: unit.id } })
  if (total <= 1) return { ok: false, error: 'У дома должен остаться хотя бы один тариф' }
  await prisma.rate.deleteMany({ where: { id: rateId, unitId: unit.id } })
  refresh()
  return { ok: true }
}

// ───────── Фото ─────────

const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

async function saveUpload(propertyId: string, file: File): Promise<string> {
  const ext = IMAGE_TYPES[file.type]
  if (!ext) throw new Error('Подойдут JPG, PNG или WebP')
  if (file.size > 10 * 1024 * 1024) throw new Error('Фото больше 10 МБ — уменьшите его')
  const dir = path.join(/* turbopackIgnore: true */ UPLOAD_DIR, propertyId)
  await mkdir(dir, { recursive: true })
  const name = `${randomUUID()}.${ext}`
  await writeFile(path.join(/* turbopackIgnore: true */ dir, name), Buffer.from(await file.arrayBuffer()))
  return `/media/${propertyId}/${name}`
}

async function removeUpload(url: string) {
  // Удаляем только свои загрузки; стартовые фото из /public не трогаем
  if (!url.startsWith('/media/')) return
  const file = path.join(/* turbopackIgnore: true */ UPLOAD_DIR, url.slice('/media/'.length))
  if (!file.startsWith(UPLOAD_DIR + path.sep)) return
  await unlink(file).catch(() => {})
}

export async function uploadUnitPhotos(unitId: string, form: FormData): Promise<ActionResult> {
  const { session, unit } = await ownUnit(unitId)
  const files = form.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0)
  if (!files.length) return { ok: false, error: 'Выберите фото' }
  if (unit.photos.length + files.length > 20) return { ok: false, error: 'Не больше 20 фото на дом' }
  try {
    const urls = []
    for (const f of files) urls.push(await saveUpload(session.propertyId, f))
    await prisma.unit.update({ where: { id: unit.id }, data: { photos: [...unit.photos, ...urls] } })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Не удалось загрузить' }
  }
  refresh()
  return { ok: true }
}

export async function updateUnitPhotos(unitId: string, photos: string[]): Promise<ActionResult> {
  const { unit } = await ownUnit(unitId)
  // Можно только переставлять и убирать то, что уже есть у дома
  const next = photos.filter((p) => unit.photos.includes(p))
  for (const removed of unit.photos.filter((p) => !next.includes(p))) await removeUpload(removed)
  await prisma.unit.update({ where: { id: unit.id }, data: { photos: next } })
  refresh()
  return { ok: true }
}

// ───────── Услуги ─────────

const extraSchema = z.object({
  name: z.string().trim().min(2, 'Назовите услугу').max(80),
  description: z.string().trim().max(200),
  group: z.string().trim().max(30),
  priceType: z.enum(['per_stay', 'per_night', 'per_person', 'per_item']),
  price: z.number().int().min(0, 'Цена не может быть отрицательной').max(100_000),
  unitLabel: z.string().trim().max(12),
  maxQty: z.number().int().min(1).max(100),
  active: z.boolean(),
})

export type ExtraInput = z.infer<typeof extraSchema>

export async function saveExtra(extraId: string | null, input: ExtraInput): Promise<ActionResult> {
  const session = await requirePermission('units:write')
  const parsed = extraSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const data = {
    ...parsed.data,
    description: parsed.data.description || null,
    group: parsed.data.group || null,
    unitLabel: parsed.data.unitLabel || null,
    maxQty: parsed.data.priceType === 'per_item' ? parsed.data.maxQty : 1,
  }
  if (extraId) {
    const extra = await prisma.extra.findFirst({ where: { id: extraId, propertyId: session.propertyId } })
    if (!extra) return { ok: false, error: 'Услуга не найдена' }
    await prisma.extra.update({ where: { id: extra.id }, data })
  } else {
    const count = await prisma.extra.count({ where: { propertyId: session.propertyId } })
    await prisma.extra.create({ data: { ...data, propertyId: session.propertyId, sortOrder: count } })
  }
  refresh()
  return { ok: true }
}

export async function deleteExtra(extraId: string): Promise<ActionResult> {
  const session = await requirePermission('units:delete')
  await prisma.extra.deleteMany({ where: { id: extraId, propertyId: session.propertyId } })
  refresh()
  return { ok: true }
}

// ───────── Усадьба: тексты и фото ─────────

const propertySchema = z.object({
  name: z.string().trim().min(2).max(60),
  kind: z.string().trim().max(40),
  tagline: z.string().trim().max(120),
  description: z.string().trim().max(1000),
  address: z.string().trim().max(200),
  phone: z.string().trim().max(30),
  phone2: z.string().trim().max(30),
  email: z.union([z.literal(''), z.email('Проверьте почту')]),
  instagram: z.string().trim().max(40),
  checkInTime: z.string().regex(/^\d{1,2}:\d{2}$/, 'Время в формате 15:00'),
  checkOutTime: z.string().regex(/^\d{1,2}:\d{2}$/, 'Время в формате 12:00'),
  bookingTerms: z.string().max(5000),
  holidays: z.array(isoDate).max(100),
})

export type PropertyInput = z.infer<typeof propertySchema>

export async function saveProperty(input: PropertyInput): Promise<ActionResult> {
  const session = await requirePermission('units:write')
  const parsed = propertySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const d = parsed.data
  const nullIfEmpty = (s: string) => (s ? s : null)
  await prisma.property.update({
    where: { id: session.propertyId },
    data: {
      ...d,
      kind: nullIfEmpty(d.kind),
      tagline: nullIfEmpty(d.tagline),
      description: nullIfEmpty(d.description),
      address: nullIfEmpty(d.address),
      phone: nullIfEmpty(d.phone),
      phone2: nullIfEmpty(d.phone2),
      email: nullIfEmpty(d.email),
      instagram: nullIfEmpty(d.instagram.replace(/^@/, '')),
      bookingTerms: nullIfEmpty(d.bookingTerms.trim()),
      holidays: [...new Set(d.holidays)].sort(),
    },
  })
  refresh()
  return { ok: true }
}

export async function uploadHeroPhoto(form: FormData): Promise<ActionResult> {
  const session = await requirePermission('units:write')
  const file = form.get('photo')
  if (!(file instanceof File) || !file.size) return { ok: false, error: 'Выберите фото' }
  try {
    const property = await prisma.property.findUniqueOrThrow({ where: { id: session.propertyId } })
    const url = await saveUpload(session.propertyId, file)
    if (property.heroPhoto) await removeUpload(property.heroPhoto)
    await prisma.property.update({ where: { id: session.propertyId }, data: { heroPhoto: url } })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Не удалось загрузить' }
  }
  refresh()
  return { ok: true }
}

// ───────── Настройки ─────────

const settingsSchema = z.object({
  showAvailability: z.boolean(),
  priceMode: z.enum(['exact', 'from', 'hidden']),
  depositPercent: z.number().int().min(0).max(100),
  callbackMinutes: z.number().int().min(5).max(24 * 60),
  paymentDetails: z.string().max(1000),
  telegramChatId: z.string().max(40),
})

export async function saveSettings(input: z.infer<typeof settingsSchema>): Promise<ActionResult> {
  const session = await requirePermission('settings:write')
  const parsed = settingsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Проверьте значения' }
  await prisma.property.update({
    where: { id: session.propertyId },
    data: { ...parsed.data, paymentDetails: parsed.data.paymentDetails || null, telegramChatId: parsed.data.telegramChatId || null },
  })
  refresh()
  return { ok: true }
}

// ───────── Календарь: закрытые даты и внешние ленты ─────────

export async function addBlock(unitId: string, start: string, end: string, reason: string): Promise<ActionResult> {
  const { unit } = await ownUnit(unitId, 'calendar:write')
  if (!isoDate.safeParse(start).success || !isoDate.safeParse(end).success || start >= end) return { ok: false, error: 'Проверьте даты' }
  await prisma.block.create({ data: { unitId: unit.id, start: toDate(start), end: toDate(end), reason: reason.trim().slice(0, 120) || 'Закрыто' } })
  refresh()
  return { ok: true }
}

export async function deleteBlock(blockId: string): Promise<ActionResult> {
  const session = await requirePermission('calendar:write')
  const block = await prisma.block.findFirst({ where: { id: blockId, unit: { propertyId: session.propertyId }, feedId: null } })
  if (!block) return { ok: false, error: 'Занятость из внешних календарей снимается там, откуда пришла' }
  await prisma.block.delete({ where: { id: block.id } })
  refresh()
  return { ok: true }
}

export async function addFeed(unitId: string, label: string, url: string): Promise<ActionResult> {
  const { unit } = await ownUnit(unitId, 'settings:write')
  if (!z.url({ protocol: /^https?$/ }).safeParse(url.trim()).success) return { ok: false, error: 'Нужна ссылка вида https://…' }
  const feed = await prisma.calendarFeed.create({ data: { unitId: unit.id, label: label.trim().slice(0, 40) || 'Календарь', url: url.trim() } })
  return syncFeed(feed.id)
}

export async function removeFeed(feedId: string): Promise<ActionResult> {
  const session = await requirePermission('settings:write')
  await prisma.calendarFeed.deleteMany({ where: { id: feedId, unit: { propertyId: session.propertyId } } })
  refresh()
  return { ok: true }
}

/** Подтянуть занятость из внешней ленты: старые записи этой ленты заменяются новыми */
export async function syncFeed(feedId: string): Promise<ActionResult> {
  const session = await requirePermission('settings:write')
  const feed = await prisma.calendarFeed.findFirst({ where: { id: feedId, unit: { propertyId: session.propertyId } } })
  if (!feed) return { ok: false, error: 'Не найдено' }

  let text: string
  try {
    // Только публичные адреса, редиректы проверяются шаг за шагом (lib/safeFetch.ts)
    text = await fetchPublicText(feed.url, { accept: 'text/calendar' })
    if (!text.includes('BEGIN:VCALENDAR')) throw new Error('по ссылке не календарь')
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'ошибка'
    await prisma.calendarFeed.update({ where: { id: feed.id }, data: { lastError: `Не удалось обновить: ${msg}` } })
    refresh()
    return { ok: false, error: `Не удалось обновить календарь: ${msg}` }
  }

  const events = parseIcal(text)
  await prisma.$transaction([
    prisma.block.deleteMany({ where: { feedId: feed.id } }),
    prisma.block.createMany({
      data: events.map((e) => ({ unitId: feed.unitId, feedId: feed.id, externalId: e.uid, start: toDate(e.start), end: toDate(e.end), reason: e.summary || `Бронь в «${feed.label}»` })),
      skipDuplicates: true,
    }),
    prisma.calendarFeed.update({ where: { id: feed.id }, data: { lastSyncAt: new Date(), lastError: null } }),
  ])
  refresh()
  return { ok: true }
}
