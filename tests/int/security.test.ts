// Доступ: вход, сессии, изоляция усадеб друг от друга, публичные адреса

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { getCookieName } from '@/lib/jwt'
import { UPLOAD_DIR } from '@/lib/uploads'
import * as A from '@/app/admin/actions'
import { login } from '@/app/login/actions'
import { GET as icalGET } from '@/app/ical/[token]/route'
import { GET as mediaGET } from '@/app/media/[...path]/route'
import { cookieJar, RedirectError } from './setup'
import { loginAs, makeLead, makeProperty, resetDb } from './fixtures'

let a: Awaited<ReturnType<typeof makeProperty>>
let b: Awaited<ReturnType<typeof makeProperty>>

beforeEach(async () => {
  await resetDb()
  a = await makeProperty('a')
  b = await makeProperty('b')
})

const redirectOf = async (p: Promise<unknown>) => {
  try {
    await p
  } catch (e) {
    if (e instanceof RedirectError) return e.url
    throw e
  }
  return null
}

describe('вход', () => {
  beforeEach(async () => {
    await prisma.user.update({ where: { id: a.user.id }, data: { passwordHash: await bcrypt.hash('верный-пароль', 10) } })
  })

  const form = (email: string, password: string) => {
    const f = new FormData()
    f.set('email', email)
    f.set('password', password)
    return f
  }

  it('неверный пароль — ошибка, сессии нет', async () => {
    expect(await login(null, form('a@test.by', 'не тот'))).toBe('Неверная почта или пароль')
    expect(cookieJar.has(getCookieName())).toBe(false)
  })

  it('неизвестная почта — та же ошибка (не подсказываем, есть ли такой пользователь)', async () => {
    expect(await login(null, form('nobody@test.by', 'x'))).toBe('Неверная почта или пароль')
  })

  it('верный пароль — сессия и переход в панель; почта без учёта регистра', async () => {
    expect(await redirectOf(login(null, form('  A@Test.BY ', 'верный-пароль')))).toBe('/admin')
    expect(cookieJar.get(getCookieName())).toBeTruthy()
  })
})

describe('сессия', () => {
  it('без входа действия панели отправляют на вход и ничего не меняют', async () => {
    const lead = await makeLead(a.property.id, a.unit.id, 5, 1)
    expect(await redirectOf(A.setLeadStatus(lead.id, 'booked'))).toBe('/login')
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe('new')
  })

  it('поддельный токен не принимается', async () => {
    cookieJar.set(getCookieName(), 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.подделка')
    expect(await redirectOf(A.saveSettings({ showAvailability: false, priceMode: 'exact', depositPercent: 1, callbackMinutes: 60, paymentDetails: '', telegramChatId: '' }))).toBe('/login')
  })

  it('пользователь удалён (или база пересоздана) — вход сбрасывается, без падения', async () => {
    await loginAs(a.user)
    await prisma.user.delete({ where: { id: a.user.id } })
    expect(await redirectOf(A.saveSettings({ showAvailability: false, priceMode: 'exact', depositPercent: 1, callbackMinutes: 60, paymentDetails: '', telegramChatId: '' }))).toBe('/logout')
  })

  it('пользователя перевели в другую усадьбу — старый токен больше не работает', async () => {
    await loginAs(a.user)
    await prisma.user.update({ where: { id: a.user.id }, data: { propertyId: b.property.id } })
    expect(await redirectOf(A.addBlock(a.unit.id, '2030-01-01', '2030-01-02', ''))).toBe('/logout')
  })
})

describe('изоляция усадеб: администратор А не трогает данные Б', () => {
  beforeEach(() => loginAs(a.user))

  it('заявки', async () => {
    const lead = await makeLead(b.property.id, b.unit.id, 5, 1)
    expect(await redirectOf(A.setLeadStatus(lead.id, 'lost'))).toBe('/admin')
    expect(await redirectOf(A.addLeadNote(lead.id, 'чужая', 'note'))).toBe('/admin')
    const saved = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id }, include: { events: true } })
    expect([saved.status, saved.events.length]).toEqual(['new', 0])
  })

  it('дома, тарифы, фото, закрытые даты, ленты', async () => {
    const rate = await prisma.rate.findFirstOrThrow({ where: { unitId: b.unit.id } })
    expect(await redirectOf(A.saveUnit(b.unit.id, { name: 'Взлом', summary: '', description: '', capacity: 1, amenities: [], longStayFromNight: null, longStayPercent: 0, active: true }))).toBe('/admin/units')
    expect(await redirectOf(A.deleteUnit(b.unit.id))).toBe('/admin/units')
    expect(await redirectOf(A.deleteRate(b.unit.id, rate.id))).toBe('/admin/units')
    expect(await redirectOf(A.updateUnitPhotos(b.unit.id, []))).toBe('/admin/units')
    expect(await redirectOf(A.addBlock(b.unit.id, '2030-01-01', '2030-01-02', ''))).toBe('/admin/units')
    expect(await redirectOf(A.addFeed(b.unit.id, 'X', 'https://example.com/x.ics'))).toBe('/admin/units')

    // Тариф Б через свой дом тоже не достать
    expect((await A.saveRate(a.unit.id, rate.id, { ...rate, startDate: null, endDate: null, pricePerNight: 1 })).ok).toBe(false)
    await A.deleteRate(a.unit.id, rate.id)

    expect(await prisma.unit.findUniqueOrThrow({ where: { id: b.unit.id } })).toMatchObject({ name: 'Дом' })
    expect(await prisma.rate.findUniqueOrThrow({ where: { id: rate.id } })).toMatchObject({ pricePerNight: rate.pricePerNight })
    expect(await prisma.block.count()).toBe(0)
  })

  it('услуги и чужие закрытые даты', async () => {
    expect((await A.saveExtra(b.bath.id, { name: 'Взлом', description: '', group: '', priceType: 'per_stay', price: 1, unitLabel: '', maxQty: 1, active: true })).ok).toBe(false)
    await A.deleteExtra(b.bath.id)
    expect(await prisma.extra.findUniqueOrThrow({ where: { id: b.bath.id } })).toMatchObject({ name: 'Баня' })

    const block = await prisma.block.create({ data: { unitId: b.unit.id, start: new Date('2030-01-01'), end: new Date('2030-01-02') } })
    expect((await A.deleteBlock(block.id)).ok).toBe(false)
    expect(await prisma.block.count()).toBe(1)
  })

  it('настройки и тексты меняются только у своей усадьбы', async () => {
    await A.saveSettings({ showAvailability: false, priceMode: 'hidden', depositPercent: 10, callbackMinutes: 30, paymentDetails: '', telegramChatId: '' })
    expect((await prisma.property.findUniqueOrThrow({ where: { id: b.property.id } })).priceMode).toBe('exact')
    expect((await prisma.property.findUniqueOrThrow({ where: { id: a.property.id } })).priceMode).toBe('hidden')
  })
})

describe('публичные адреса', () => {
  it('iCal-лента: только подтверждённые брони и ручные закрытия, без имён гостей', async () => {
    await makeLead(a.property.id, a.unit.id, 5, 2, 'booked')
    await makeLead(a.property.id, a.unit.id, 10, 1, 'new')
    await prisma.block.create({ data: { unitId: a.unit.id, start: new Date('2030-01-01'), end: new Date('2030-01-02') } })
    const res = await icalGET(new Request('http://test.local'), { params: Promise.resolve({ token: `${a.unit.icalToken}.ics` }) })
    const text = await res.text()
    expect(res.headers.get('content-type')).toMatch(/text\/calendar/)
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(text).not.toMatch(/Гость/)
  })

  it('iCal по неверному токену — 404', async () => {
    const res = await icalGET(new Request('http://test.local'), { params: Promise.resolve({ token: 'guess.ics' }) })
    expect(res.status).toBe(404)
  })

  it('фото отдаются, а выйти за папку загрузок нельзя', async () => {
    await mkdir(path.join(UPLOAD_DIR, a.property.id), { recursive: true })
    await writeFile(path.join(UPLOAD_DIR, a.property.id, 'p.jpg'), 'jpeg')
    const ok = await mediaGET(new Request('http://test.local'), { params: Promise.resolve({ path: [a.property.id, 'p.jpg'] }) })
    expect(ok.status).toBe(200)
    expect(ok.headers.get('content-type')).toBe('image/jpeg')

    for (const evil of [['..', '..', '.env'], [a.property.id, '..', '..', 'package.json'], ['..', 'usadba-test-uploads.jpg']]) {
      const res = await mediaGET(new Request('http://test.local'), { params: Promise.resolve({ path: evil }) })
      expect(res.status).toBe(404)
    }
    // Только картинки
    await writeFile(path.join(UPLOAD_DIR, a.property.id, 'x.txt'), 'secret')
    expect((await mediaGET(new Request('http://test.local'), { params: Promise.resolve({ path: [a.property.id, 'x.txt'] }) })).status).toBe(404)
  })
})
