import { describe, expect, it } from 'vitest'
import { pickRate, quote, type QuoteInput, type QuoteRate } from './quote'

const base: QuoteRate = { name: 'Будни', startDate: null, endDate: null, weekdays: [], pricePerNight: 300, extraGuestPrice: 40, priority: 0 }
const weekend: QuoteRate = { name: 'Выходные', startDate: null, endDate: null, weekdays: [5, 6], pricePerNight: 450, extraGuestPrice: 40, priority: 10 }
const newYear: QuoteRate = { name: 'Новый год', startDate: '2026-12-30', endDate: '2027-01-01', weekdays: [], pricePerNight: 1200, extraGuestPrice: 0, priority: 100 }

const input = (over: Partial<QuoteInput> = {}): QuoteInput => ({
  unit: { name: 'Дом у пруда', kind: 'house', capacity: 12, baseGuests: 8 },
  rates: [base, weekend, newYear],
  extras: [
    { id: 'bath', name: 'Баня', priceType: 'per_stay', price: 150 },
    { id: 'breakfast', name: 'Завтрак', priceType: 'per_person', price: 20 },
    { id: 'tub', name: 'Чан', priceType: 'per_night', price: 120 },
  ],
  checkIn: '2026-11-04', // среда
  checkOut: '2026-11-06',
  guests: 8,
  extraIds: [],
  ...over,
})

describe('pickRate', () => {
  it('берёт правило с наибольшим приоритетом', () => {
    expect(pickRate([base, weekend], '2026-11-07')?.name).toBe('Выходные') // суббота
    expect(pickRate([base, weekend], '2026-11-04')?.name).toBe('Будни')
  })

  it('учитывает границы периода включительно', () => {
    expect(pickRate([base, newYear], '2026-12-30')?.name).toBe('Новый год')
    expect(pickRate([base, newYear], '2027-01-01')?.name).toBe('Новый год')
    expect(pickRate([base, newYear], '2027-01-02')?.name).toBe('Будни')
  })

  it('возвращает null, если ничего не подходит', () => {
    expect(pickRate([weekend], '2026-11-04')).toBeNull()
  })
})

describe('quote', () => {
  it('считает ночи по их собственным тарифам', () => {
    const q = quote(input({ checkIn: '2026-11-05', checkOut: '2026-11-08' })) // ночи чт, пт, сб
    expect(q.nights.map((n) => n.rate)).toEqual(['Будни', 'Выходные', 'Выходные'])
    expect(q.lodging).toBe(300 + 450 + 450)
    expect(q.ok).toBe(true)
  })

  it('добавляет доплату за гостей сверх базового количества', () => {
    const q = quote(input({ guests: 11 }))
    expect(q.nights[0].extraGuests).toBe(3)
    expect(q.lodging).toBe(2 * (300 + 3 * 40))
  })

  it('считает допуслуги по их типу цены', () => {
    const q = quote(input({ guests: 10, extraIds: ['bath', 'breakfast', 'tub'] }))
    const byId = Object.fromEntries(q.extras.map((l) => [l.id, l.total]))
    expect(byId).toEqual({ bath: 150, breakfast: 10 * 20, tub: 2 * 120 })
    expect(q.total).toBe(q.lodging + 150 + 200 + 240)
  })

  it('не даёт превысить вместимость', () => {
    const q = quote(input({ guests: 13 }))
    expect(q.ok).toBe(false)
    expect(q.errors[0]).toMatch(/до 12 гостей/)
  })

  it('ругается на перепутанные даты', () => {
    const q = quote(input({ checkIn: '2026-11-06', checkOut: '2026-11-06' }))
    expect(q.ok).toBe(false)
    expect(q.nights).toHaveLength(0)
  })

  it('сообщает о датах без цены, а не считает их бесплатными', () => {
    const q = quote(input({ rates: [weekend] }))
    expect(q.ok).toBe(false)
    expect(q.lodging).toBe(0)
  })
})
