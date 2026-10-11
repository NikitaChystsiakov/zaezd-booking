// Панель управления: каждое действие — что оно записывает в базу

import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { toDate, toISO } from '@/lib/dates'
import { UPLOAD_DIR } from '@/lib/uploads'
import * as A from '@/app/admin/actions'
import { RedirectError } from './setup'
import { day, loginAs, makeLead, makeProperty, resetDb } from './fixtures'

let ctx: Awaited<ReturnType<typeof makeProperty>>

beforeEach(async () => {
  await resetDb()
  ctx = await makeProperty('a')
  await loginAs(ctx.user)
})

afterEach(() => vi.unstubAllGlobals())

const redirectOf = async (p: Promise<unknown>) => {
  try {
    await p
  } catch (e) {
    if (e instanceof RedirectError) return e.url
    throw e
  }
  return null
}

describe('заявки', () => {
  it('статус меняется и пишется в историю', async () => {
    const lead = await makeLead(ctx.property.id, ctx.unit.id, 10, 2)
    expect(await A.setLeadStatus(lead.id, 'contacted')).toEqual({ ok: true })
    expect(await A.setLeadStatus(lead.id, 'booked')).toEqual({ ok: true })
    const saved = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id }, include: { events: { orderBy: { createdAt: 'asc' } } } })
    expect(saved.status).toBe('booked')
    expect(saved.contactedAt).not.toBeNull()
    expect(saved.events.map((e) => [e.type, e.userId])).toEqual([
      ['status', ctx.user.id],
      ['status', ctx.user.id],
    ])
  })

  it('подтвердить пересекающуюся бронь нельзя', async () => {
    await makeLead(ctx.property.id, ctx.unit.id, 10, 2, 'booked')
    const lead = await makeLead(ctx.property.id, ctx.unit.id, 11, 2)
    const res = await A.setLeadStatus(lead.id, 'booked')
    expect(res.ok).toBe(false)
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe('new')
  })

  it('даже если проверка в коде пропущена, двойную бронь не даёт сама база', async () => {
    await makeLead(ctx.property.id, ctx.unit.id, 10, 2, 'booked')
    const lead = await makeLead(ctx.property.id, ctx.unit.id, 11, 2)
    await expect(prisma.lead.update({ where: { id: lead.id }, data: { status: 'booked' } })).rejects.toThrow(/Lead_no_double_booking/)
  })

  it('две одновременные попытки подтвердить одни даты — проходит ровно одна', async () => {
    const a = await makeLead(ctx.property.id, ctx.unit.id, 10, 2)
    const b = await makeLead(ctx.property.id, ctx.unit.id, 10, 2)
    const results = await Promise.all([A.setLeadStatus(a.id, 'booked'), A.setLeadStatus(b.id, 'booked')])
    expect(results.filter((r) => r.ok)).toHaveLength(1)
    expect(await prisma.lead.count({ where: { status: 'booked' } })).toBe(1)
  })

  it('итог звонка сохраняется и двигает новую заявку дальше', async () => {
    const lead = await makeLead(ctx.property.id, ctx.unit.id, 10, 2)
    expect(await A.addLeadNote(lead.id, '  Созвонились, переведёт задаток  ', 'call')).toEqual({ ok: true })
    const saved = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id }, include: { events: true } })
    expect(saved.status).toBe('contacted')
    expect(saved.events[0]).toMatchObject({ type: 'call', text: 'Созвонились, переведёт задаток' })
    expect((await A.addLeadNote(lead.id, '   ', 'note')).ok).toBe(false)
  })
})

describe('дома', () => {
  it('новый дом создаётся скрытым и со стартовым тарифом', async () => {
    const url = await redirectOf(A.createUnit('Дом у пруда', 6))
    const unit = await prisma.unit.findFirstOrThrow({ where: { name: 'Дом у пруда' }, include: { rates: true } })
    expect(url).toBe(`/admin/units/${unit.id}`)
    expect(unit).toMatchObject({ propertyId: ctx.property.id, slug: 'u-pruda', capacity: 6, active: false })
    expect(unit.rates).toHaveLength(1)
  })

  it('одинаковые названия получают разные адреса', async () => {
    await redirectOf(A.createUnit('Дом', 4))
    const slugs = (await prisma.unit.findMany({ where: { propertyId: ctx.property.id } })).map((u) => u.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('описание, удобства и скидка сохраняются', async () => {
    const res = await A.saveUnit(ctx.unit.id, {
      name: 'Дом КАНТРИ', summary: 'Сруб', description: 'Пять спален', capacity: 15,
      amenities: ['Баня', 'Пруд'], longStayFromNight: 3, longStayPercent: 10, active: true,
    })
    expect(res).toEqual({ ok: true })
    expect(await prisma.unit.findUniqueOrThrow({ where: { id: ctx.unit.id } })).toMatchObject({ name: 'Дом КАНТРИ', capacity: 15, amenities: ['Баня', 'Пруд'] })
  })

  it('кривые данные не сохраняются', async () => {
    const res = await A.saveUnit(ctx.unit.id, { name: 'Д', summary: '', description: '', capacity: 0, amenities: [], longStayFromNight: null, longStayPercent: 0, active: true })
    expect(res.ok).toBe(false)
    expect((await prisma.unit.findUniqueOrThrow({ where: { id: ctx.unit.id } })).name).toBe('Дом')
  })

  it('дом с бронями не удаляется', async () => {
    await makeLead(ctx.property.id, ctx.unit.id, 10, 2, 'booked')
    expect((await A.deleteUnit(ctx.unit.id)).ok).toBe(false)
    expect(await prisma.unit.count()).toBe(1)
  })

  it('пустой дом удаляется вместе с тарифами', async () => {
    expect(await redirectOf(A.deleteUnit(ctx.unit.id))).toBe('/admin/units')
    expect(await prisma.rate.count()).toBe(0)
  })
})

describe('тарифы', () => {
  const rate = (over: Partial<A.RateInput> = {}): A.RateInput => ({
    name: 'Пятница', weekdays: [5, 5], holidaysOnly: false, startDate: null, endDate: null, minGuests: 1, maxGuests: null,
    includedGuests: 8, pricePerNight: 450, extraGuestPrice: 40, bookableWithinDays: null, priority: 5, ...over,
  })

  it('добавляется, меняется и удаляется', async () => {
    expect(await A.saveRate(ctx.unit.id, null, rate())).toEqual({ ok: true })
    const created = await prisma.rate.findFirstOrThrow({ where: { name: 'Пятница' } })
    expect(created.weekdays).toEqual([5]) // повтор дня убран

    expect(await A.saveRate(ctx.unit.id, created.id, rate({ pricePerNight: 480, startDate: day(1), endDate: day(60) }))).toEqual({ ok: true })
    const updated = await prisma.rate.findUniqueOrThrow({ where: { id: created.id } })
    expect(updated.pricePerNight).toBe(480)
    expect(toISO(updated.startDate!)).toBe(day(1))

    expect(await A.deleteRate(ctx.unit.id, created.id)).toEqual({ ok: true })
    expect(await prisma.rate.count({ where: { id: created.id } })).toBe(0)
  })

  it.each([
    ['гостей «до» меньше «от»', { minGuests: 5, maxGuests: 2 }],
    ['период задом наперёд', { startDate: day(10), endDate: day(1) }],
    ['отрицательная цена', { pricePerNight: -1 }],
    ['пустое название', { name: '' }],
  ])('%s — не сохраняется', async (_, over) => {
    expect((await A.saveRate(ctx.unit.id, null, rate(over))).ok).toBe(false)
  })

  it('последний тариф дома удалить нельзя', async () => {
    const rates = await prisma.rate.findMany({ where: { unitId: ctx.unit.id } })
    for (const r of rates.slice(1)) await A.deleteRate(ctx.unit.id, r.id)
    expect((await A.deleteRate(ctx.unit.id, rates[0].id)).ok).toBe(false)
    expect(await prisma.rate.count()).toBe(1)
  })
})

describe('фото', () => {
  const jpeg = (name: string, bytes = 1024) => new File([new Uint8Array(bytes).fill(0xff)], name, { type: 'image/jpeg' })
  const form = (...files: File[]) => {
    const f = new FormData()
    for (const file of files) f.append('photos', file)
    return f
  }
  const diskPath = (url: string) => path.join(UPLOAD_DIR, url.replace('/media/', ''))

  it('загружаются на диск и добавляются к дому по порядку', async () => {
    expect(await A.uploadUnitPhotos(ctx.unit.id, form(jpeg('1.jpg', 3000), jpeg('2.jpg')))).toEqual({ ok: true })
    const { photos } = await prisma.unit.findUniqueOrThrow({ where: { id: ctx.unit.id } })
    expect(photos).toHaveLength(2)
    expect(photos[0]).toMatch(new RegExp(`^/media/${ctx.property.id}/[0-9a-f-]+\\.jpg$`))
    expect((await stat(diskPath(photos[0]))).size).toBe(3000)
  })

  it('не картинки и слишком большие файлы отклоняются', async () => {
    const pdf = new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' })
    expect((await A.uploadUnitPhotos(ctx.unit.id, form(pdf))).ok).toBe(false)
    expect((await A.uploadUnitPhotos(ctx.unit.id, form(jpeg('big.jpg', 11 * 1024 * 1024)))).ok).toBe(false)
    expect((await prisma.unit.findUniqueOrThrow({ where: { id: ctx.unit.id } })).photos).toEqual([])
  })

  it('перестановка сохраняет порядок, удалённое фото стирается с диска', async () => {
    await A.uploadUnitPhotos(ctx.unit.id, form(jpeg('1.jpg'), jpeg('2.jpg'), jpeg('3.jpg')))
    const { photos } = await prisma.unit.findUniqueOrThrow({ where: { id: ctx.unit.id } })
    await A.updateUnitPhotos(ctx.unit.id, [photos[2], photos[0]])
    expect((await prisma.unit.findUniqueOrThrow({ where: { id: ctx.unit.id } })).photos).toEqual([photos[2], photos[0]])
    await expect(stat(diskPath(photos[1]))).rejects.toThrow()
    await readFile(diskPath(photos[0]))
  })

  it('подсунуть дому чужой путь через перестановку нельзя', async () => {
    await A.updateUnitPhotos(ctx.unit.id, ['/media/../../etc/passwd', '/p/other.jpg'])
    expect((await prisma.unit.findUniqueOrThrow({ where: { id: ctx.unit.id } })).photos).toEqual([])
  })

  it('главное фото усадьбы заменяется, старое удаляется', async () => {
    const one = new FormData()
    one.append('photo', jpeg('hero1.jpg'))
    await A.uploadHeroPhoto(one)
    const first = (await prisma.property.findUniqueOrThrow({ where: { id: ctx.property.id } })).heroPhoto!
    const two = new FormData()
    two.append('photo', jpeg('hero2.jpg'))
    await A.uploadHeroPhoto(two)
    const second = (await prisma.property.findUniqueOrThrow({ where: { id: ctx.property.id } })).heroPhoto!
    expect(second).not.toBe(first)
    await expect(stat(diskPath(first))).rejects.toThrow()
    await stat(diskPath(second))
  })
})

describe('услуги, тексты, настройки', () => {
  it('услуга создаётся, меняется и удаляется', async () => {
    const extra = { name: 'Веник', description: '', group: 'Баня', priceType: 'per_item' as const, price: 15, unitLabel: 'шт.', maxQty: 6, active: true }
    expect(await A.saveExtra(null, extra)).toEqual({ ok: true })
    const created = await prisma.extra.findFirstOrThrow({ where: { name: 'Веник' } })
    expect(created).toMatchObject({ propertyId: ctx.property.id, group: 'Баня', description: null, maxQty: 6 })

    await A.saveExtra(created.id, { ...extra, priceType: 'per_stay', maxQty: 10, price: 20 })
    // Для «один раз за заезд» количество не выбирается
    expect(await prisma.extra.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({ price: 20, maxQty: 1 })

    await A.deleteExtra(created.id)
    expect(await prisma.extra.count({ where: { id: created.id } })).toBe(0)
  })

  it('тексты, контакты и праздники усадьбы сохраняются', async () => {
    const res = await A.saveProperty({
      name: 'Буцевичи', kind: 'Конная усадьба', tagline: 'Отдых в седле', description: '', address: '', phone: '+375 29 322-20-44',
      phone2: '', email: 'contact@verhom.by', instagram: '@verhomby', checkInTime: '15:00', checkOutTime: '12:00',
      bookingTerms: 'Задаток 40%\nЗаезд с 15:00\n', holidays: [day(30), day(10), day(30)],
    })
    expect(res).toEqual({ ok: true })
    expect(await prisma.property.findUniqueOrThrow({ where: { id: ctx.property.id } })).toMatchObject({
      name: 'Буцевичи', description: null, phone2: null, instagram: 'verhomby', bookingTerms: 'Задаток 40%\nЗаезд с 15:00', holidays: [day(10), day(30)],
    })
  })

  it('кривая почта и время не сохраняются', async () => {
    const base = { name: 'X усадьба', kind: '', tagline: '', description: '', address: '', phone: '', phone2: '', email: '', instagram: '', checkInTime: '15:00', checkOutTime: '12:00', bookingTerms: '', holidays: [] }
    expect((await A.saveProperty({ ...base, email: 'не почта' })).ok).toBe(false)
    expect((await A.saveProperty({ ...base, checkInTime: 'после обеда' })).ok).toBe(false)
  })

  it('режимы показа и задаток сохраняются', async () => {
    const res = await A.saveSettings({ showAvailability: false, priceMode: 'hidden', depositPercent: 30, callbackMinutes: 90, paymentDetails: 'ЕРИП', telegramChatId: '' })
    expect(res).toEqual({ ok: true })
    expect(await prisma.property.findUniqueOrThrow({ where: { id: ctx.property.id } })).toMatchObject({ showAvailability: false, priceMode: 'hidden', depositPercent: 30, telegramChatId: null })
    expect((await A.saveSettings({ showAvailability: true, priceMode: 'exact', depositPercent: 150, callbackMinutes: 60, paymentDetails: '', telegramChatId: '' })).ok).toBe(false)
  })
})

describe('календарь и внешние ленты', () => {
  it('закрытые даты добавляются и снимаются', async () => {
    expect(await A.addBlock(ctx.unit.id, day(5), day(7), 'Ремонт печи')).toEqual({ ok: true })
    const block = await prisma.block.findFirstOrThrow()
    expect([toISO(block.start), toISO(block.end), block.reason]).toEqual([day(5), day(7), 'Ремонт печи'])
    expect((await A.addBlock(ctx.unit.id, day(7), day(5), '')).ok).toBe(false)
    expect(await A.deleteBlock(block.id)).toEqual({ ok: true })
    expect(await prisma.block.count()).toBe(0)
  })

  const ics = (events: [string, string, string][]) =>
    ['BEGIN:VCALENDAR', ...events.flatMap(([uid, a, b]) => ['BEGIN:VEVENT', `UID:${uid}`, `DTSTART;VALUE=DATE:${a.replaceAll('-', '')}`, `DTEND;VALUE=DATE:${b.replaceAll('-', '')}`, 'SUMMARY:Бронь', 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n')

  it('лента Куфара подтягивается; при обновлении старые записи заменяются новыми', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(ics([['k1', day(3), day(5)], ['k2', day(9), day(10)]])))
    vi.stubGlobal('fetch', fetchMock)
    expect(await A.addFeed(ctx.unit.id, 'Куфар', 'https://kufar.example/cal.ics')).toEqual({ ok: true })
    expect(await prisma.block.count({ where: { feed: { label: 'Куфар' } } })).toBe(2)

    // Гость на Куфаре отменил одну бронь
    fetchMock.mockResolvedValueOnce(new Response(ics([['k2', day(9), day(10)]])))
    const feed = await prisma.calendarFeed.findFirstOrThrow()
    expect(await A.syncFeed(feed.id)).toEqual({ ok: true })
    expect((await prisma.block.findMany()).map((b) => b.externalId)).toEqual(['k2'])

    // Вручную снять занятость Куфара нельзя — только там, откуда пришла
    const block = await prisma.block.findFirstOrThrow()
    expect((await A.deleteBlock(block.id)).ok).toBe(false)

    // Отключили ленту — её занятость пропала
    await A.removeFeed(feed.id)
    expect(await prisma.block.count()).toBe(0)
  })

  it('ошибка загрузки ленты запоминается, старая занятость остаётся', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(ics([['k1', day(3), day(5)]]))))
    await A.addFeed(ctx.unit.id, 'Реалт', 'https://realt.example/cal.ics')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('<html>404</html>', { status: 404 })))
    const feed = await prisma.calendarFeed.findFirstOrThrow()
    expect((await A.syncFeed(feed.id)).ok).toBe(false)
    expect((await prisma.calendarFeed.findUniqueOrThrow({ where: { id: feed.id } })).lastError).toMatch(/404/)
    expect(await prisma.block.count()).toBe(1)
  })

  it.each(['http://localhost:5432/', 'http://127.0.0.1/', 'http://192.168.1.1/cal.ics', 'http://10.0.0.5/'])('внутренний адрес %s не запрашивается', async (url) => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect((await A.addFeed(ctx.unit.id, 'X', url)).ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ссылка не http(s) не принимается', async () => {
    expect((await A.addFeed(ctx.unit.id, 'X', 'file:///etc/passwd')).ok).toBe(false)
    expect(await prisma.calendarFeed.count()).toBe(0)
  })
})

describe('данные хранятся без лишнего', () => {
  it('удаление усадьбы чистит всё связанное (каскад)', async () => {
    await makeLead(ctx.property.id, ctx.unit.id, 3, 2, 'booked')
    await prisma.block.create({ data: { unitId: ctx.unit.id, start: toDate(day(5)), end: toDate(day(6)) } })
    await prisma.property.delete({ where: { id: ctx.property.id } })
    const counts = await Promise.all([prisma.user.count(), prisma.unit.count(), prisma.rate.count(), prisma.extra.count(), prisma.lead.count(), prisma.block.count()])
    expect(counts).toEqual([0, 0, 0, 0, 0, 0])
  })
})
