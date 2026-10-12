// Роли и права (docs/ROLES.md): что может каждая роль и что при этом остаётся нетронутым в базе

import bcrypt from 'bcryptjs'
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/session'
import * as A from '@/app/admin/actions'
import * as T from '@/app/admin/team/actions'
import { login } from '@/app/login/actions'
import { RedirectError } from './setup'
import { loginAs, makeLead, makeProperty, makeUser, resetDb } from './fixtures'

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

const FORBIDDEN = '/admin/forbidden'
const unitInput = { name: 'Новое имя', summary: '', description: '', capacity: 5, amenities: [], longStayFromNight: null, longStayPercent: 0, active: true }
const extraInput = { name: 'Чан', description: '', group: '', priceType: 'per_stay' as const, price: 200, unitLabel: '', maxQty: 1, active: true }
const settingsInput = { showAvailability: false, priceMode: 'hidden' as const, depositPercent: 10, callbackMinutes: 30, paymentDetails: 'ЕРИП', telegramChatId: '' }

async function as(role: 'owner' | 'admin' | 'staff') {
  const user = role === 'owner' ? a.user : await makeUser(a.property.id, role)
  await loginAs(user)
  return user
}

describe('staff (администратор): заявки и календарь', () => {
  beforeEach(() => as('staff'))

  it('работает с заявками и закрывает даты', async () => {
    const lead = await makeLead(a.property.id, a.unit.id, 5, 1)
    expect(await A.setLeadStatus(lead.id, 'contacted')).toEqual({ ok: true })
    expect(await A.addLeadNote(lead.id, 'Перезвонил', 'note')).toEqual({ ok: true })
    expect(await A.addBlock(a.unit.id, '2030-01-01', '2030-01-03', 'Ремонт')).toEqual({ ok: true })
    expect(await prisma.block.count()).toBe(1)
  })

  it('не меняет дома, тарифы, услуги и тексты — ни одной записи не изменено', async () => {
    const rate = await prisma.rate.findFirstOrThrow({ where: { unitId: a.unit.id } })
    const calls = [
      () => A.saveUnit(a.unit.id, unitInput),
      () => A.createUnit('Новый дом', 4),
      () => A.saveRate(a.unit.id, rate.id, { ...rate, startDate: null, endDate: null, pricePerNight: 1 }),
      () => A.updateUnitPhotos(a.unit.id, []),
      () => A.saveExtra(null, extraInput),
      () => A.saveExtra(a.bath.id, extraInput),
      () => A.saveProperty({ name: 'Взлом', kind: '', tagline: '', description: '', address: '', phone: '', phone2: '', email: '', instagram: '', checkInTime: '15:00', checkOutTime: '12:00', bookingTerms: '', holidays: [] }),
    ]
    for (const call of calls) expect(await redirectOf(call())).toBe(FORBIDDEN)

    expect(await prisma.unit.count({ where: { propertyId: a.property.id } })).toBe(1)
    expect((await prisma.unit.findUniqueOrThrow({ where: { id: a.unit.id } })).name).toBe('Дом')
    expect((await prisma.rate.findUniqueOrThrow({ where: { id: rate.id } })).pricePerNight).toBe(rate.pricePerNight)
    expect(await prisma.extra.count()).toBe(2)
    expect((await prisma.property.findUniqueOrThrow({ where: { id: a.property.id } })).name).toBe('Усадьба a')
  })

  it('не удаляет, не трогает настройки, ленты и команду', async () => {
    const rate = await prisma.rate.findFirstOrThrow({ where: { unitId: a.unit.id } })
    const calls = [
      () => A.deleteUnit(a.unit.id),
      () => A.deleteRate(a.unit.id, rate.id),
      () => A.deleteExtra(a.bath.id),
      () => A.saveSettings(settingsInput),
      () => A.addFeed(a.unit.id, 'Куфар', 'https://kufar.example/cal.ics'),
      () => T.inviteUser({ name: 'Новый', email: 'new@test.by', role: 'staff' }),
      () => T.changeRole(a.user.id, 'staff'),
      () => T.removeUser(a.user.id),
      () => T.resetPassword(a.user.id),
    ]
    for (const call of calls) expect(await redirectOf(call())).toBe(FORBIDDEN)

    expect(await prisma.unit.count()).toBe(2)
    expect(await prisma.extra.count()).toBe(2)
    expect((await prisma.property.findUniqueOrThrow({ where: { id: a.property.id } })).priceMode).toBe('exact')
    expect(await prisma.calendarFeed.count()).toBe(0)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: a.user.id } })).role).toBe('owner')
  })
})

describe('admin (управляющий): дома и цены, но не деньги и не команда', () => {
  beforeEach(() => as('admin'))

  it('правит дома, тарифы, услуги и тексты, создаёт дом', async () => {
    expect(await A.saveUnit(a.unit.id, unitInput)).toEqual({ ok: true })
    expect(await A.saveExtra(null, extraInput)).toEqual({ ok: true })
    expect(await A.saveExtra(a.bath.id, { ...extraInput, name: 'Баня' })).toEqual({ ok: true })
    const rate = await prisma.rate.findFirstOrThrow({ where: { unitId: a.unit.id } })
    expect(await A.saveRate(a.unit.id, rate.id, { ...rate, startDate: null, endDate: null, pricePerNight: 350 })).toEqual({ ok: true })
    expect(await redirectOf(A.createUnit('Баня у озера', 6))).toMatch(/^\/admin\/units\/.+/)

    expect((await prisma.unit.findUniqueOrThrow({ where: { id: a.unit.id } })).name).toBe('Новое имя')
    expect((await prisma.rate.findUniqueOrThrow({ where: { id: rate.id } })).pricePerNight).toBe(350)
    expect(await prisma.unit.count({ where: { propertyId: a.property.id } })).toBe(2)
  })

  it('не удаляет дома, тарифы и услуги', async () => {
    const rate = await prisma.rate.findFirstOrThrow({ where: { unitId: a.unit.id } })
    expect(await redirectOf(A.deleteUnit(a.unit.id))).toBe(FORBIDDEN)
    expect(await redirectOf(A.deleteRate(a.unit.id, rate.id))).toBe(FORBIDDEN)
    expect(await redirectOf(A.deleteExtra(a.bath.id))).toBe(FORBIDDEN)
    expect(await prisma.unit.count({ where: { id: a.unit.id } })).toBe(1)
    expect(await prisma.extra.count({ where: { id: a.bath.id } })).toBe(1)
  })

  it('не трогает настройки, реквизиты, ленты и команду', async () => {
    expect(await redirectOf(A.saveSettings(settingsInput))).toBe(FORBIDDEN)
    expect(await redirectOf(A.addFeed(a.unit.id, 'Куфар', 'https://kufar.example/cal.ics'))).toBe(FORBIDDEN)
    expect(await redirectOf(T.inviteUser({ name: 'Новый', email: 'new@test.by', role: 'admin' }))).toBe(FORBIDDEN)
    expect((await prisma.property.findUniqueOrThrow({ where: { id: a.property.id } })).paymentDetails).toBeNull()
    expect(await prisma.user.count({ where: { propertyId: a.property.id } })).toBe(2)
  })
})

describe('owner (владелец)', () => {
  beforeEach(() => as('owner'))

  it('может всё: удалять, менять настройки, подключать ленты', async () => {
    expect(await A.saveSettings(settingsInput)).toEqual({ ok: true })
    expect((await prisma.property.findUniqueOrThrow({ where: { id: a.property.id } })).paymentDetails).toBe('ЕРИП')
    expect(await A.deleteExtra(a.bath.id)).toEqual({ ok: true })
    expect(await redirectOf(A.deleteUnit(a.unit.id))).toBe('/admin/units')
    expect(await prisma.unit.count({ where: { propertyId: a.property.id } })).toBe(0)
  })
})

describe('роль берётся из базы, а не из токена', () => {
  it('понижение действует сразу, без перевхода', async () => {
    const user = await makeUser(a.property.id, 'admin')
    await loginAs(user)
    expect(await A.saveUnit(a.unit.id, unitInput)).toEqual({ ok: true })
    await prisma.user.update({ where: { id: user.id }, data: { role: 'staff' } })
    expect(await redirectOf(A.saveUnit(a.unit.id, { ...unitInput, name: 'Ещё раз' }))).toBe(FORBIDDEN)
    expect((await prisma.unit.findUniqueOrThrow({ where: { id: a.unit.id } })).name).toBe('Новое имя')
  })

  it('повышение в токене не работает: подделать роль в cookie нельзя', async () => {
    const user = await makeUser(a.property.id, 'staff')
    await loginAs({ ...user, role: 'owner' }) // токен утверждает «владелец», в базе — staff
    expect(await redirectOf(requirePermission('team:manage'))).toBe(FORBIDDEN)
    expect(await redirectOf(A.saveSettings(settingsInput))).toBe(FORBIDDEN)
  })
})

describe('команда', () => {
  beforeEach(() => as('owner'))

  it('приглашённый получает временный пароль и может войти', async () => {
    const res = await T.inviteUser({ name: 'Марина', email: ' Marina@Test.by ', role: 'staff' })
    expect(res.ok).toBe(true)
    const password = res.ok ? res.password! : ''
    expect(password.length).toBeGreaterThanOrEqual(10)

    const saved = await prisma.user.findUniqueOrThrow({ where: { email: 'marina@test.by' } })
    expect(saved).toMatchObject({ propertyId: a.property.id, role: 'staff', name: 'Марина' })
    expect(saved.passwordHash).not.toContain(password)
    expect(await bcrypt.compare(password, saved.passwordHash)).toBe(true)

    const form = new FormData()
    form.set('email', 'marina@test.by')
    form.set('password', password)
    expect(await redirectOf(login(null, form))).toBe('/admin')
  })

  it('занятая почта и неверные данные отклоняются', async () => {
    expect((await T.inviteUser({ name: 'Двойник', email: b.user.email, role: 'staff' })).ok).toBe(false)
    expect((await T.inviteUser({ name: 'А', email: 'x@test.by', role: 'staff' })).ok).toBe(false)
    expect((await T.inviteUser({ name: 'Иван', email: 'не-почта', role: 'staff' })).ok).toBe(false)
    expect(await prisma.user.count({ where: { propertyId: a.property.id } })).toBe(1)
  })

  it('роль можно менять, но последний владелец остаётся', async () => {
    const admin = await makeUser(a.property.id, 'admin')
    expect(await T.changeRole(admin.id, 'staff')).toEqual({ ok: true })
    expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).role).toBe('staff')

    const last = await T.changeRole(a.user.id, 'admin')
    expect(last).toMatchObject({ ok: false, error: expect.stringMatching(/владелец/) })
    expect((await prisma.user.findUniqueOrThrow({ where: { id: a.user.id } })).role).toBe('owner')

    // Со вторым владельцем себя понизить можно
    await T.changeRole(admin.id, 'owner')
    expect(await T.changeRole(a.user.id, 'admin')).toEqual({ ok: true })
  })

  it('удалять можно других, но не себя и не последнего владельца', async () => {
    const staff = await makeUser(a.property.id, 'staff')
    expect(await T.removeUser(staff.id)).toEqual({ ok: true })
    expect(await prisma.user.count({ where: { id: staff.id } })).toBe(0)
    expect((await T.removeUser(a.user.id)).ok).toBe(false)
    expect(await prisma.user.count({ where: { id: a.user.id } })).toBe(1)
  })

  it('удалённый сотрудник теряет доступ сразу', async () => {
    const staff = await makeUser(a.property.id, 'staff')
    await T.removeUser(staff.id)
    await loginAs(staff)
    expect(await redirectOf(A.addBlock(a.unit.id, '2030-01-01', '2030-01-02', ''))).toBe('/logout')
  })

  it('новый пароль заменяет старый', async () => {
    const staff = await makeUser(a.property.id, 'staff')
    await prisma.user.update({ where: { id: staff.id }, data: { passwordHash: await bcrypt.hash('старый', 10) } })
    const res = await T.resetPassword(staff.id)
    expect(res.ok).toBe(true)
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: staff.id } })
    expect(await bcrypt.compare('старый', saved.passwordHash)).toBe(false)
    expect(await bcrypt.compare(res.ok ? res.password! : '', saved.passwordHash)).toBe(true)
  })

  it('пользователей другой усадьбы не видно и не тронуть', async () => {
    const calls = [T.changeRole(b.user.id, 'staff'), T.removeUser(b.user.id), T.resetPassword(b.user.id)]
    for (const res of await Promise.all(calls)) expect(res).toMatchObject({ ok: false, error: 'Пользователь не найден' })
    expect(await prisma.user.findUniqueOrThrow({ where: { id: b.user.id } })).toMatchObject({ role: 'owner', passwordHash: 'x', propertyId: b.property.id })
  })
})
