// Публичная форма бронирования: что попадает в базу и что отклоняется

import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { createLead, type LeadInput } from '@/app/u/[slug]/actions'
import { busyNights } from '@/lib/availability'
import { toDate, toISO } from '@/lib/dates'
import { day, makeLead, makeProperty, nextWeekday, resetDb, today } from './fixtures'

let ctx: Awaited<ReturnType<typeof makeProperty>>

const input = (over: Partial<LeadInput> = {}): LeadInput => ({
  unitId: ctx.unit.id,
  checkIn: day(20),
  checkOut: day(22),
  guests: 6,
  children: 1,
  picks: [],
  occasion: 'День рождения',
  name: 'Анна',
  phone: '+375 29 123-45-67',
  contactVia: 'telegram',
  comment: 'Будем с собакой',
  ...over,
})

beforeEach(async () => {
  await resetDb()
  ctx = await makeProperty('a')
})

describe('createLead — сохранение', () => {
  it('сохраняет заявку со всеми полями, расчётом и событием в истории', async () => {
    const res = await createLead('a', input({ picks: [{ id: ctx.bath.id, qty: 2 }] }))
    expect(res).toMatchObject({ ok: true })

    const lead = await prisma.lead.findFirstOrThrow({ include: { events: true } })
    expect(lead).toMatchObject({
      propertyId: ctx.property.id,
      unitId: ctx.unit.id,
      status: 'new',
      guests: 6,
      children: 1,
      name: 'Анна',
      contactVia: 'telegram',
      comment: 'Будем с собакой',
    })
    expect(toISO(lead.checkIn)).toBe(day(20))
    expect(toISO(lead.checkOut)).toBe(day(22))
    expect(lead.extras).toEqual([{ id: ctx.bath.id, qty: 2 }])
    expect(lead.estimate).toBe((lead.quote as { total: number }).total)
    expect(lead.events.map((e) => e.type)).toEqual(['created'])
  })

  it('цену считает сервер — подделать её из браузера нельзя', async () => {
    const res = await createLead('a', { ...input(), estimate: 1, quote: { total: 1 } } as LeadInput)
    expect(res.ok).toBe(true)
    const lead = await prisma.lead.findFirstOrThrow()
    expect(lead.estimate).toBeGreaterThan(100)
  })

  it('услуги чужой усадьбы и лишнее количество отбрасываются', async () => {
    const other = await makeProperty('b')
    await createLead('a', input({ picks: [{ id: other.bath.id, qty: 1 }, { id: ctx.bath.id, qty: 50 }] }))
    const lead = await prisma.lead.findFirstOrThrow()
    expect(lead.extras).toEqual([{ id: ctx.bath.id, qty: 50 }])
    // В расчёт попадает не больше maxQty = 2
    expect((lead.quote as { extras: { qty: number }[] }).extras).toEqual([expect.objectContaining({ qty: 2, total: 200 })])
  })
})

describe('createLead — проверки', () => {
  it.each([
    ['пустое имя', { name: ' ' }, /обращаться/],
    ['кривой телефон', { phone: 'позвоните мне' }, /телефон/],
    ['выезд раньше заезда', { checkIn: day(5), checkOut: day(5) }, /даты/],
    ['дата в прошлом', { checkIn: day(-3), checkOut: day(-1) }, /прошла/],
    ['больше вместимости', { guests: 11 }, /до 10 гостей/],
  ])('%s — отказ', async (_, over, message) => {
    const res = await createLead('a', input(over as Partial<LeadInput>))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(message)
    expect(await prisma.lead.count()).toBe(0)
  })

  it('боты, заполнившие скрытое поле, отсекаются', async () => {
    const res = await createLead('a', input({ website: 'http://spam' }))
    expect(res.ok).toBe(false)
    expect(await prisma.lead.count()).toBe(0)
  })

  it('дом другой усадьбы выбрать нельзя', async () => {
    const other = await makeProperty('b')
    const res = await createLead('a', input({ unitId: other.unit.id }))
    expect(res).toEqual({ ok: false, error: 'Дом не найден' })
  })

  it('скрытый с сайта дом не бронируется', async () => {
    await prisma.unit.update({ where: { id: ctx.unit.id }, data: { active: false } })
    expect((await createLead('a', input())).ok).toBe(false)
  })

  it('на занятые даты заявку не принимаем, если гость видит занятость', async () => {
    await makeLead(ctx.property.id, ctx.unit.id, 21, 2, 'booked')
    const res = await createLead('a', input())
    expect(res).toEqual({ ok: false, error: 'Эти даты уже заняты — выберите другие' })
  })

  it('даты, закрытые вручную или из Куфара, тоже заняты', async () => {
    await prisma.block.create({ data: { unitId: ctx.unit.id, start: toDate(day(19)), end: toDate(day(21)), reason: 'ремонт' } })
    expect((await createLead('a', input())).ok).toBe(false)
  })

  it('день выезда чужой брони может быть днём заезда новой', async () => {
    await makeLead(ctx.property.id, ctx.unit.id, 18, 2, 'booked') // выезд в день 20
    expect((await createLead('a', input())).ok).toBe(true)
  })

  it('если владелец скрыл занятость — заявку принимаем, решит администратор', async () => {
    await prisma.property.update({ where: { id: ctx.property.id }, data: { showAvailability: false } })
    await makeLead(ctx.property.id, ctx.unit.id, 21, 2, 'booked')
    expect((await createLead('a', input())).ok).toBe(true)
  })

  it('заявки в работе даты не занимают', async () => {
    await makeLead(ctx.property.id, ctx.unit.id, 20, 2, 'new')
    expect((await createLead('a', input())).ok).toBe(true)
  })
})

describe('расчёт в заявке', () => {
  it('суббота по своему тарифу, гости сверх базы доплачивают', async () => {
    const sat = nextWeekday(6, 20)
    await createLead('a', input({ checkIn: day(sat), checkOut: day(sat + 1), guests: 10 }))
    const lead = await prisma.lead.findFirstOrThrow()
    expect(lead.estimate).toBe(500 + 2 * 40)
  })

  it('праздник важнее субботы и будней', async () => {
    await createLead('a', input({ checkIn: day(40), checkOut: day(41), guests: 8 }))
    expect((await prisma.lead.findFirstOrThrow()).estimate).toBe(600)
  })

  it('тариф для компании открыт только за 14 дней', async () => {
    const tue = nextWeekday(2, 3)
    await createLead('a', input({ checkIn: day(tue), checkOut: day(tue + 1), guests: 3 }))
    expect((await prisma.lead.findFirstOrThrow()).estimate).toBe(150 + 50)

    await prisma.lead.deleteMany()
    const farTue = nextWeekday(2, 30)
    await createLead('a', input({ checkIn: day(farTue), checkOut: day(farTue + 1), guests: 3 }))
    const lead = await prisma.lead.findFirstOrThrow()
    expect(lead.estimate).toBe(300)
    expect((lead.quote as { notes: string[] }).notes[0]).toMatch(/открывается за 14/)
  })
})

describe('занятость для календаря на сайте', () => {
  it('ночи броней и закрытых дат — заняты, заявки в работе — нет', async () => {
    await makeLead(ctx.property.id, ctx.unit.id, 3, 2, 'booked')
    await makeLead(ctx.property.id, ctx.unit.id, 10, 1, 'new')
    await prisma.block.create({ data: { unitId: ctx.unit.id, start: toDate(day(7)), end: toDate(day(8)) } })
    const busy = await busyNights(ctx.property.id, today, 30)
    expect(busy[ctx.unit.id]).toEqual([day(3), day(4), day(7)])
  })
})
