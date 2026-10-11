// Демо-усадьба «Сосновый Брод» (вымышленная). Даты считаются от сегодняшнего дня,
// поэтому демо всегда выглядит «живым»: свежие заявки, ближайшие заезды, прошлые гости.

import { PrismaClient, type LeadStatus, type ContactVia } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { addDays, todayISO, toDate } from '../lib/dates'
import { quote, type QuoteExtra, type QuoteRate } from '../lib/quote'

const prisma = new PrismaClient()
const T = todayISO()
const day = (n: number) => toDate(addDays(T, n))
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000)

async function main() {
  await prisma.property.deleteMany()

  const property = await prisma.property.create({
    data: {
      slug: 'sosnovy-brod',
      name: 'Сосновый Брод',
      tagline: 'Усадьба для компаний у реки, 40 минут от Минска',
      description:
        'Три дома, баня на дровах, чан и шатёр на 60 гостей у воды. Принимаем дни рождения, корпоративы, девичники и семейные выходные.',
      address: 'Логойский р-н, д. Сосновый Брод (демо)',
      phone: '+375 29 000-00-00',
      showAvailability: false,
      priceMode: 'from',
      prepaymentPercent: 30,
      callbackMinutes: 60,
      paymentDetails: 'ЕРИП → Агроэкотуризм → «Сосновый Брод» → номер брони\nили перевод на карту 4255 •••• •••• 0000 (Ольга К.)',
    },
  })

  await prisma.user.create({
    data: {
      propertyId: property.id,
      email: 'demo@gurtom.by',
      name: 'Ольга',
      role: 'owner',
      passwordHash: await bcrypt.hash('demo', 10),
    },
  })

  const weekday = (price: number, extra: number): QuoteRate & { startDate: string | null; endDate: string | null } => ({
    name: 'Будни', startDate: null, endDate: null, weekdays: [], pricePerNight: price, extraGuestPrice: extra, priority: 0,
  })
  const weekend = (price: number, extra: number): QuoteRate & { startDate: string | null; endDate: string | null } => ({
    name: 'Выходные', startDate: null, endDate: null, weekdays: [5, 6], pricePerNight: price, extraGuestPrice: extra, priority: 10,
  })
  const newYear = (price: number): QuoteRate & { startDate: string | null; endDate: string | null } => ({
    name: 'Новогодние', startDate: '2026-12-30', endDate: '2027-01-02', weekdays: [], pricePerNight: price, extraGuestPrice: 0, priority: 100,
  })

  const unitsData = [
    {
      slug: 'senoval', name: 'Дом «Сеновал»', kind: 'house' as const, capacity: 14, baseGuests: 10, sortOrder: 1,
      photo: '/units/senoval.svg',
      description: 'Главный дом: гостиная с камином на 20 человек, 5 спален, большая кухня, терраса к реке.',
      rates: [weekday(420, 35), weekend(620, 35), newYear(1500)],
    },
    {
      slug: 'paseka', name: 'Дом «Пасека»', kind: 'house' as const, capacity: 10, baseGuests: 8, sortOrder: 2,
      photo: '/units/paseka.svg',
      description: 'Сруб у соснового бора, 4 спальни, своя баня-бочка и мангал.',
      rates: [weekday(320, 30), weekend(480, 30), newYear(1100)],
    },
    {
      slug: 'lipa', name: 'Дом «Липа»', kind: 'house' as const, capacity: 6, baseGuests: 4, sortOrder: 3,
      photo: '/units/lipa.svg',
      description: 'Небольшой дом для семьи или пары пар: 2 спальни, печь, веранда.',
      rates: [weekday(210, 25), weekend(310, 25), newYear(800)],
    },
    {
      slug: 'shater', name: 'Шатёр «Луг»', kind: 'venue' as const, capacity: 60, baseGuests: 60, sortOrder: 4,
      photo: '/units/shater.svg',
      description: 'Шатёр у воды для банкета: столы, свет, звук, гирлянды. Аренда на день до 23:00.',
      rates: [weekday(900, 0), weekend(1400, 0)],
    },
  ]

  const units: Record<string, { id: string; quoteUnit: { name: string; kind: 'house' | 'venue'; capacity: number; baseGuests: number }; rates: QuoteRate[] }> = {}
  for (const u of unitsData) {
    const { rates, ...rest } = u
    const created = await prisma.unit.create({
      data: {
        ...rest,
        propertyId: property.id,
        rates: {
          create: rates.map((r) => ({
            ...r,
            startDate: r.startDate ? toDate(r.startDate) : null,
            endDate: r.endDate ? toDate(r.endDate) : null,
          })),
        },
      },
    })
    units[u.slug] = { id: created.id, quoteUnit: { name: u.name, kind: u.kind, capacity: u.capacity, baseGuests: u.baseGuests }, rates }
  }

  const extrasData = [
    { name: 'Баня на дровах', description: '3 часа, веники, чай', priceType: 'per_stay' as const, price: 120 },
    { name: 'Чан с травами', description: 'Горячая купель под открытым небом', priceType: 'per_night' as const, price: 150 },
    { name: 'Завтрак', description: 'Домашний: сырники, яйца, блины', priceType: 'per_person' as const, price: 18 },
    { name: 'Конная прогулка', description: 'Час по лесу с инструктором', priceType: 'per_person' as const, price: 35 },
    { name: 'Мангал с дровами', description: 'Решётки, шампуры, розжиг', priceType: 'per_stay' as const, price: 40 },
    { name: 'Поздний выезд', description: 'До 18:00', priceType: 'per_stay' as const, price: 60 },
  ]
  const extras: QuoteExtra[] = []
  for (const [i, e] of extrasData.entries()) {
    const created = await prisma.extra.create({ data: { ...e, propertyId: property.id, sortOrder: i } })
    extras.push({ id: created.id, name: created.name, priceType: created.priceType, price: created.price })
  }
  const ex = (name: string) => extras.find((e) => e.name.startsWith(name))!.id

  type SeedLead = {
    unit: string | null; status: LeadStatus; occasion: string; from: number; nights: number; guests: number
    name: string; phone: string; contactVia?: ContactVia; comment?: string; extras?: string[]; createdMinAgo: number
    events?: { type: 'call' | 'note' | 'status'; text: string; minAgo: number }[]
  }

  const leads: SeedLead[] = [
    { unit: 'senoval', status: 'new', occasion: 'День рождения', from: 12, nights: 2, guests: 14, name: 'Артём', phone: '+375 29 111-22-33', contactVia: 'telegram', comment: 'Будет 14 человек, хотим баню и чан. Можно ли свою музыку до часу ночи?', extras: [ex('Баня'), ex('Чан')], createdMinAgo: 25 },
    { unit: 'shater', status: 'new', occasion: 'Корпоратив', from: 20, nights: 1, guests: 35, name: 'Марина (ООО «Вектор»)', phone: '+375 44 222-33-44', comment: 'Нужен банкет на 35 человек, своя кухня или кейтеринг? Нужен договор и безнал.', createdMinAgo: 190 },
    { unit: null, status: 'new', occasion: 'Девичник', from: 9, nights: 1, guests: 9, name: 'Катя', phone: '+375 33 333-44-55', contactVia: 'viber', comment: 'Не знаем, какой дом выбрать, подскажите', extras: [ex('Чан')], createdMinAgo: 70 },
    {
      unit: 'lipa', status: 'contacted', occasion: 'Семейные выходные', from: 5, nights: 2, guests: 5, name: 'Сергей', phone: '+375 29 444-55-66', extras: [ex('Завтрак')], createdMinAgo: 60 * 20,
      events: [{ type: 'call', text: 'Созвонились. Едут с собакой (лабрадор) — разрешили, предупредил про залог 50 BYN. Ждут КП в Viber.', minAgo: 60 * 18 }],
    },
    {
      unit: 'senoval', status: 'proposal', occasion: 'Юбилей 50 лет', from: 16, nights: 2, guests: 14, name: 'Наталья', phone: '+375 29 555-66-77', contactVia: 'telegram', extras: [ex('Баня'), ex('Мангал')], createdMinAgo: 60 * 30,
      events: [{ type: 'call', text: 'Юбилей мужа, приедут дети и друзья. Бюджет до 2 000. Скидываются вчетвером — отправила КП со сбором.', minAgo: 60 * 26 }],
    },
    { unit: 'paseka', status: 'booked', occasion: 'Выходные с друзьями', from: 2, nights: 2, guests: 8, name: 'Дмитрий', phone: '+375 29 666-77-88', extras: [ex('Баня')], createdMinAgo: 60 * 24 * 6 },
    { unit: 'lipa', status: 'booked', occasion: 'Годовщина', from: 12, nights: 3, guests: 2, name: 'Алина', phone: '+375 44 777-88-99', extras: [ex('Завтрак'), ex('Конная')], createdMinAgo: 60 * 24 * 9 },
    { unit: 'shater', status: 'booked', occasion: 'Свадьба', from: 27, nights: 1, guests: 55, name: 'Игорь и Вера', phone: '+375 29 888-99-00', createdMinAgo: 60 * 24 * 40 },
    { unit: 'senoval', status: 'booked', occasion: 'Свадьба — проживание гостей', from: 27, nights: 2, guests: 14, name: 'Игорь и Вера', phone: '+375 29 888-99-00', createdMinAgo: 60 * 24 * 40 },
    { unit: 'paseka', status: 'done', occasion: 'День рождения', from: -6, nights: 2, guests: 10, name: 'Павел', phone: '+375 33 123-45-67', extras: [ex('Баня'), ex('Чан')], createdMinAgo: 60 * 24 * 20 },
    { unit: 'senoval', status: 'done', occasion: 'Корпоратив', from: -12, nights: 1, guests: 14, name: 'IT-команда «Пиксель»', phone: '+375 29 765-43-21', createdMinAgo: 60 * 24 * 30 },
    { unit: 'paseka', status: 'lost', occasion: 'Выпускной', from: 30, nights: 1, guests: 25, name: 'Олег', phone: '+375 29 321-00-11', createdMinAgo: 60 * 24 * 3, events: [{ type: 'note', text: 'Хотели 25 человек с ночёвкой — не помещаемся, отказались.', minAgo: 60 * 24 * 2 }] },
  ]

  const admin = await prisma.user.findFirstOrThrow({ where: { propertyId: property.id } })

  for (const l of leads) {
    const checkIn = addDays(T, l.from)
    const checkOut = addDays(T, l.from + l.nights)
    const u = l.unit ? units[l.unit] : null
    const q = u
      ? quote({ unit: u.quoteUnit, rates: u.rates, extras, checkIn, checkOut, guests: l.guests, extraIds: l.extras ?? [] })
      : null
    const created = await prisma.lead.create({
      data: {
        propertyId: property.id,
        unitId: u?.id ?? null,
        status: l.status,
        occasion: l.occasion,
        checkIn: toDate(checkIn),
        checkOut: toDate(checkOut),
        guests: l.guests,
        name: l.name,
        phone: l.phone,
        contactVia: l.contactVia ?? 'call',
        comment: l.comment,
        extraIds: l.extras ?? [],
        quote: q ?? undefined,
        estimate: q?.ok ? q.total : null,
        createdAt: minutesAgo(l.createdMinAgo),
        contactedAt: l.status === 'new' ? null : minutesAgo(l.createdMinAgo - 30),
        events: {
          create: [
            { type: 'created', text: 'Заявка с сайта', createdAt: minutesAgo(l.createdMinAgo) },
            ...(l.events ?? []).map((e) => ({ type: e.type, text: e.text, userId: admin.id, createdAt: minutesAgo(e.minAgo) })),
          ],
        },
      },
    })

    if (l.status === 'proposal' && u) {
      const opt = (extraIds: string[]) =>
        quote({ unit: u.quoteUnit, rates: u.rates, extras, checkIn, checkOut, guests: l.guests, extraIds }).total
      const options = [
        { id: 'base', title: 'Только дом', note: 'Дом на двое суток, мангал', extraIds: [ex('Мангал')], price: opt([ex('Мангал')]) },
        { id: 'optimum', title: 'Дом + баня', note: 'Самый популярный вариант для юбилеев', extraIds: [ex('Баня'), ex('Мангал')], price: opt([ex('Баня'), ex('Мангал')]) },
        { id: 'all', title: 'Всё включено', note: 'Баня, чан оба вечера, завтраки, поздний выезд', extraIds: [ex('Баня'), ex('Мангал'), ex('Чан'), ex('Завтрак'), ex('Поздний')], price: opt([ex('Баня'), ex('Мангал'), ex('Чан'), ex('Завтрак'), ex('Поздний')]) },
      ]
      const prepayment = Math.round((options[1].price * property.prepaymentPercent) / 100 / 10) * 10
      await prisma.proposal.create({
        data: {
          leadId: created.id,
          options,
          chosenOptionId: 'optimum',
          message: 'Наталья, добрый день! Как договорились — три варианта на юбилей. Для брони дат нужна предоплата, её удобно собрать с компании по ссылке ниже.',
          prepaymentAmount: prepayment,
          views: 3,
          lastViewedAt: minutesAgo(12),
          createdAt: minutesAgo(60 * 25),
          contributions: {
            create: [
              { name: 'Наталья', amount: Math.round(prepayment / 4), status: 'confirmed', confirmedAt: minutesAgo(60 * 20), createdAt: minutesAgo(60 * 24) },
              { name: 'Андрей', amount: Math.round(prepayment / 4), status: 'marked_paid', createdAt: minutesAgo(60 * 5) },
              { name: 'Лена', amount: Math.round(prepayment / 4), status: 'pledged', createdAt: minutesAgo(40) },
            ],
          },
        },
      })
      await prisma.leadEvent.create({ data: { leadId: created.id, userId: admin.id, type: 'proposal_sent', text: 'КП отправлено', createdAt: minutesAgo(60 * 25) } })
      await prisma.leadEvent.create({ data: { leadId: created.id, type: 'proposal_viewed', text: 'Клиент открыл КП (3-й раз)', createdAt: minutesAgo(12) } })
    }
  }

  // Занятость, пришедшая из внешних календарей
  const kufar = await prisma.calendarFeed.create({
    data: { unitId: units.paseka.id, label: 'Куфар', url: 'https://example.com/demo-kufar.ics', lastSyncAt: minutesAgo(15) },
  })
  await prisma.block.create({ data: { unitId: units.paseka.id, start: day(7), end: day(9), reason: 'Бронь с Куфара', feedId: kufar.id, externalId: 'demo-1' } })
  await prisma.block.create({ data: { unitId: units.lipa.id, start: day(19), end: day(22), reason: 'Ремонт печи' } })

  console.log('Демо-усадьба создана. Вход: demo@gurtom.by / demo')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
