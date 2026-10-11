// Тесты на реальных ценах дома КАНТРИ (verhom.by, раздел «Услуги и цены»)

import { describe, expect, it } from 'vitest'
import { quote, depositFor, type QuoteExtra, type QuoteInput, type QuoteRate } from './quote'

const whole = (name: string, weekdays: number[], price: number, extra: Partial<QuoteRate> = {}): QuoteRate => ({
  name, weekdays, holidaysOnly: false, startDate: null, endDate: null, minGuests: 1, maxGuests: null,
  includedGuests: 10, pricePerNight: price, extraGuestPrice: 65, bookableWithinDays: null, priority: 0, ...extra,
})
const small = (name: string, weekdays: number[], price: number, extra: Partial<QuoteRate> = {}): QuoteRate => ({
  name, weekdays, holidaysOnly: false, startDate: null, endDate: null, minGuests: 1, maxGuests: 8,
  includedGuests: 2, pricePerNight: price, extraGuestPrice: 65, bookableWithinDays: 14, priority: 0, ...extra,
})

const RATES: QuoteRate[] = [
  whole('Будни', [1, 2, 3, 4], 890),
  whole('Пятница', [5], 1050),
  whole('Суббота', [6], 1350),
  whole('Воскресенье', [0], 920),
  whole('Праздники', [], 1350, { holidaysOnly: true, priority: 10 }),
  small('Небольшая компания, пн–чт', [1, 2, 3, 4], 350),
  small('Небольшая компания, пт и вс', [5, 0], 420),
]

const EXTRAS: QuoteExtra[] = [
  { id: 'bath', name: 'Баня, сеанс 2 часа на двоих', priceType: 'per_item', price: 130, unitLabel: 'сеанс', maxQty: 3 },
  { id: 'bathHour', name: 'Баня, дополнительный час', priceType: 'per_item', price: 50, unitLabel: 'ч', maxQty: 4 },
  { id: 'broom', name: 'Веник', priceType: 'per_item', price: 15, unitLabel: 'шт.', maxQty: 6 },
  { id: 'pet', name: 'Проживание с питомцем', priceType: 'per_stay', price: 30, unitLabel: null, maxQty: 1 },
  { id: 'ride', name: 'Конная прогулка 30 минут', priceType: 'per_person', price: 50, unitLabel: 'чел.', maxQty: 1 },
]

// 2026-11-09 — понедельник, 2026-11-13 — пятница, 2026-11-14 — суббота
const input = (over: Partial<QuoteInput> = {}): QuoteInput => ({
  unit: { name: 'Дом КАНТРИ', capacity: 15, longStayFromNight: 3, longStayPercent: 10 },
  rates: RATES,
  extras: EXTRAS,
  picks: [],
  checkIn: '2026-11-09',
  checkOut: '2026-11-10',
  guests: 10,
  holidays: ['2026-11-07', '2027-03-08'],
  today: '2026-11-01',
  ...over,
})

describe('тарифы по дням недели', () => {
  it('будний день, 10 гостей — 890', () => {
    expect(quote(input()).total).toBe(890)
  })

  it('пятница и суббота — по своим ценам', () => {
    const q = quote(input({ checkIn: '2026-11-13', checkOut: '2026-11-15' }))
    expect(q.nights.map((n) => [n.rate, n.total])).toEqual([['Пятница', 1050], ['Суббота', 1350]])
  })

  it('праздник в понедельник считается по праздничному тарифу', () => {
    const q = quote(input({ checkIn: '2027-03-08', checkOut: '2027-03-09', today: '2027-01-10' }))
    expect(q.nights[0]).toMatchObject({ rate: 'Праздники', holiday: true, total: 1350 })
  })
})

describe('гости', () => {
  it('сверх 10 мест — по 65 за человека', () => {
    expect(quote(input({ guests: 12 })).total).toBe(890 + 2 * 65)
  })

  it('небольшая компания в будни платит меньше, чем за весь дом', () => {
    const q = quote(input({ guests: 5 }))
    expect(q.nights[0].rate).toBe('Небольшая компания, пн–чт')
    expect(q.total).toBe(350 + 3 * 65)
  })

  it('9 гостей — уже весь дом', () => {
    expect(quote(input({ guests: 9 })).nights[0].rate).toBe('Будни')
  })

  it('в субботу тарифа для небольшой компании нет', () => {
    const q = quote(input({ guests: 2, checkIn: '2026-11-14', checkOut: '2026-11-15' }))
    expect(q.nights[0]).toMatchObject({ rate: 'Суббота', total: 1350 })
  })

  it('больше вместимости — ошибка', () => {
    const q = quote(input({ guests: 16 }))
    expect(q.ok).toBe(false)
    expect(q.errors[0]).toMatch(/до 15 гостей/)
  })
})

describe('окно бронирования', () => {
  it('раньше чем за 14 дней тариф для компании закрыт, гость видит пояснение', () => {
    const q = quote(input({ guests: 2, today: '2026-10-01' }))
    expect(q.nights[0].rate).toBe('Будни')
    expect(q.notes[0]).toMatch(/открывается за 14 дн/)
  })

  it('за 14 дней и ближе — открыт', () => {
    const q = quote(input({ guests: 2, today: '2026-10-26' }))
    expect(q.nights[0].rate).toBe('Небольшая компания, пн–чт')
    expect(q.notes).toEqual([])
  })
})

describe('долгое проживание', () => {
  it('с третьей ночи скидка 10%', () => {
    const q = quote(input({ checkIn: '2026-11-09', checkOut: '2026-11-13' })) // пн–чт, 4 ночи
    expect(q.nights.map((n) => n.discount)).toEqual([0, 0, 89, 89])
    expect(q.total).toBe(890 * 4 - 178)
    expect(q.discount).toBe(178)
  })
})

describe('услуги', () => {
  it('баня считается по сеансам и часам, прогулка — на каждого гостя', () => {
    const q = quote(input({
      guests: 4,
      today: '2026-11-01',
      picks: [{ id: 'bath', qty: 1 }, { id: 'bathHour', qty: 1 }, { id: 'broom', qty: 2 }, { id: 'pet', qty: 1 }, { id: 'ride', qty: 1 }],
    }))
    const byId = Object.fromEntries(q.extras.map((l) => [l.id, l.total]))
    expect(byId).toEqual({ bath: 130, bathHour: 50, broom: 30, pet: 30, ride: 4 * 50 })
  })

  it('не даёт заказать больше допустимого количества', () => {
    const q = quote(input({ picks: [{ id: 'broom', qty: 50 }] }))
    expect(q.extras[0].qty).toBe(6)
  })
})

describe('задаток', () => {
  it('40% с округлением вверх', () => {
    expect(depositFor(1365, 40)).toBe(546)
  })
})
