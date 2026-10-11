// Конная усадьба «Буцевичи» (verhom.by). Тексты, цены и условия — с их сайта,
// раздел «Услуги и цены» и страница «Проживание». Заявки — демонстрационные.
// Даты заявок считаются от сегодняшнего дня, чтобы демо всегда выглядело «живым».

import { PrismaClient, type LeadStatus, type ContactVia } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { addDays, todayISO, toDate } from '../lib/dates'
import { quote, type ExtraPick, type QuoteExtra, type QuoteRate } from '../lib/quote'

const prisma = new PrismaClient()
const T = todayISO()
const day = (n: number) => toDate(addDays(T, n))
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000)
const photo = (name: string) => `/p/butsevichi/${name}.jpg`

// Государственные праздники РБ. TODO(цены): уточнить, считаются ли праздничными
// предновогодние дни и летний сезон — на сайте «цена может отличаться, уточняйте».
const HOLIDAYS = [
  '2026-11-07', '2026-12-25',
  '2027-01-01', '2027-01-02', '2027-01-07', '2027-03-08', '2027-05-01', '2027-05-09', '2027-05-11',
  '2027-07-03', '2027-11-07', '2027-12-25',
]

const TERMS = [
  'Для брони дома нужен задаток 40% от стоимости проживания. При отмене по инициативе гостя задаток не возвращается.',
  'Заселение с 15:00 до 20:00, выезд с 9:00 до 12:00. Позднее заселение и ранний выезд — по договорённости и за доплату.',
  'С компаний от 6 человек берём залог 200 BYN за сохранность имущества — возвращаем в день выезда.',
  'Заселение с питомцами — по согласованию заранее, 30 BYN.',
  'Указывайте точное количество гостей, включая детей. Дети до 3 лет без отдельного места — бесплатно.',
  'Дом для компании от 2 до 8 человек можно забронировать не раньше чем за две недели до заезда.',
  'Летом бронь на одну ночь открывается не раньше чем за месяц.',
].join('\n')

type SeedRate = Omit<QuoteRate, 'startDate' | 'endDate'>

const whole = (name: string, weekdays: number[], price: number, includedGuests: number, extra: Partial<SeedRate> = {}): SeedRate => ({
  name, weekdays, holidaysOnly: false, minGuests: 1, maxGuests: null, includedGuests,
  pricePerNight: price, extraGuestPrice: 65, bookableWithinDays: null, priority: 0, ...extra,
})

// TODO(цены): на странице дома КАНТРИ для небольшой компании в пт и вс указано 450 и +70 за гостя,
// в «Услугах и ценах» — 420 и +65. Берём «Услуги и цены», уточнить у клиента.
const small = (name: string, weekdays: number[], price: number, extra: Partial<SeedRate> = {}): SeedRate => ({
  name, weekdays, holidaysOnly: false, minGuests: 1, maxGuests: 8, includedGuests: 2,
  pricePerNight: price, extraGuestPrice: 65, bookableWithinDays: 14, priority: 0, ...extra,
})

const houseRates = (included: number): SeedRate[] => [
  whole('Будни, пн–чт', [1, 2, 3, 4], 890, included),
  whole('Пятница', [5], 1050, included),
  whole('Суббота', [6], 1350, included),
  whole('Воскресенье', [0], 920, included),
  whole('Праздничные дни', [], 1350, included, { holidaysOnly: true, priority: 10 }),
  small('Небольшая компания, пн–чт', [1, 2, 3, 4], 350),
  small('Небольшая компания, пт и вс', [5, 0], 420),
  small('Небольшая компания, праздники', [], 420, { holidaysOnly: true, priority: 10 }),
]

async function main() {
  await prisma.property.deleteMany()

  // Постоянные id: после пересоздания демо-данных уже открытая сессия остаётся рабочей
  const property = await prisma.property.create({
    data: {
      id: 'demo-butsevichi',
      slug: 'butsevichi',
      name: 'Буцевичи',
      kind: 'Конная усадьба',
      tagline: 'Отдых в седле — отдых с душой',
      description:
        'Два гостевых дома, баня на дровах, пруды и конюшня на 2,5 гектарах. 23 км от Минска по трассе на Мядель — 17 минут от МКАД.',
      address: 'д. Буцевичи, 23 км от Минска по трассе Р58 (на Мядель)',
      phone: '+375 29 322-20-44',
      phone2: '+375 29 777-20-44',
      email: 'contact@verhom.by',
      instagram: 'verhomby',
      heroPhoto: photo('chalet-evening'),
      theme: 'forest',
      checkInTime: '15:00',
      checkOutTime: '12:00',
      bookingTerms: TERMS,
      holidays: HOLIDAYS,
      showAvailability: true,
      priceMode: 'exact',
      depositPercent: 40,
      callbackMinutes: 60,
    },
  })

  const admin = await prisma.user.create({
    data: {
      id: 'demo-admin',
      propertyId: property.id,
      email: 'demo@zaezd.by',
      name: 'Администратор',
      role: 'owner',
      passwordHash: await bcrypt.hash('demo', 10),
    },
  })

  const unitsData = [
    {
      slug: 'kantri',
      name: 'Дом КАНТРИ',
      summary: 'Двухэтажный сруб из вековой сосны',
      description:
        'Пять спален с кроватями king size и ортопедическими матрасами, два санузла и большая гостиная с мини-кухней — в ней соберутся до 25 человек. Выход на летнюю террасу, рядом зарыбленный пруд с пирсом и костровая зона с кроватью-качелью. Тёплый пол, Wi-Fi, телевидение.',
      // TODO(вместимость): на сайте «10 + 4 на диванах», «14» и «до 15» — уточнить
      capacity: 15,
      photos: ['country-day', 'country-sunset', 'country-living', 'country-bedroom'].map(photo),
      amenities: ['5 спален', '10 мест + 4 на диванах', '2 санузла', 'Гостиная до 25 человек', 'Пруд с пирсом', 'Мангальная зона', 'Тёплый пол и Wi-Fi'],
      rates: houseRates(10),
    },
    {
      slug: 'shale',
      name: 'Дом ШАЛЕ',
      summary: 'Одноэтажный дом в стиле эко-лофт, 2020 года',
      description:
        'Четыре спальни, два санузла, гостиная с ирландской печью-камином и выход на летнюю террасу с мангальной зоной. Кровати king size, тёплый пол, газовое отопление, оптоволоконный Wi-Fi. Для гостей — релакс-зона с бассейном.',
      capacity: 12,
      photos: ['chalet-evening', 'chalet-day', 'chalet-living', 'chalet-fireplace'].map(photo),
      amenities: ['4 спальни', 'до 12 гостей', '2 санузла', 'Печь-камин', 'Терраса с мангалом', 'Релакс-зона с бассейном', 'Тёплый пол и Wi-Fi'],
      rates: houseRates(12),
    },
  ]

  const units: Record<string, { id: string; unit: { name: string; capacity: number; longStayFromNight: number; longStayPercent: number }; rates: QuoteRate[] }> = {}
  for (const [i, u] of unitsData.entries()) {
    const { rates, ...rest } = u
    const created = await prisma.unit.create({
      data: {
        ...rest,
        propertyId: property.id,
        kind: 'house',
        sortOrder: i,
        longStayFromNight: 3,
        longStayPercent: 10,
        rates: { create: rates.map((r, j) => ({ ...r, sortOrder: j })) },
      },
    })
    units[u.slug] = {
      id: created.id,
      unit: { name: u.name, capacity: u.capacity, longStayFromNight: 3, longStayPercent: 10 },
      rates: rates.map((r) => ({ ...r, startDate: null, endDate: null })),
    }
  }

  const extrasData = [
    { group: 'Баня', name: 'Баня на дровах, сеанс 2 часа', description: 'Сруб из кругляка: парная, комната отдыха, полотенца, чай. Цена — на двоих.', priceType: 'per_item' as const, price: 130, unitLabel: 'сеанс', maxQty: 3 },
    { group: 'Баня', name: 'Дополнительный час бани', description: null, priceType: 'per_item' as const, price: 50, unitLabel: 'ч', maxQty: 4 },
    { group: 'Баня', name: 'Гость в бане сверх двух', description: 'Баня рассчитана на 2–4 человек', priceType: 'per_item' as const, price: 20, unitLabel: 'чел.', maxQty: 2 },
    { group: 'Баня', name: 'Веник берёзовый или дубовый', description: null, priceType: 'per_item' as const, price: 15, unitLabel: 'шт.', maxQty: 6 },
    { group: 'Лошади', name: 'Конная прогулка, 1 час', description: 'Для компании от 4 взрослых. Лошадью управляете сами — инструктор едет впереди.', priceType: 'per_item' as const, price: 75, unitLabel: 'чел.', maxQty: 15 },
    { group: 'Лошади', name: 'Конная прогулка, 30 минут', description: null, priceType: 'per_item' as const, price: 50, unitLabel: 'чел.', maxQty: 15 },
    { group: 'Кухня', name: 'Обед на гриле', description: 'Крылышко, свиная шея, деревенская колбаска, картофель, салат', priceType: 'per_item' as const, price: 33, unitLabel: 'порц.', maxQty: 30 },
    { group: 'Кухня', name: 'Блинчики на козьем молоке', description: 'С шоколадом, мороженым и чаем на травах', priceType: 'per_item' as const, price: 15, unitLabel: 'порц.', maxQty: 30 },
    { group: 'Ещё', name: 'Подготовка мангала', description: null, priceType: 'per_stay' as const, price: 10, unitLabel: null, maxQty: 1 },
    { group: 'Ещё', name: 'Гость без ночлега, до 22:00', description: null, priceType: 'per_item' as const, price: 40, unitLabel: 'чел.', maxQty: 12 },
    { group: 'Ещё', name: 'Проживание с питомцем', description: 'По согласованию заранее', priceType: 'per_stay' as const, price: 30, unitLabel: null, maxQty: 1 },
  ]
  const extras: QuoteExtra[] = []
  for (const [i, e] of extrasData.entries()) {
    const c = await prisma.extra.create({ data: { ...e, propertyId: property.id, sortOrder: i } })
    extras.push({ id: c.id, name: c.name, priceType: c.priceType, price: c.price, unitLabel: c.unitLabel, maxQty: c.maxQty })
  }
  const ex = (name: string, qty = 1): ExtraPick => ({ id: extras.find((e) => e.name.startsWith(name))!.id, qty })

  type SeedLead = {
    unit: 'kantri' | 'shale' | null; status: LeadStatus; occasion?: string; from: number; nights: number; guests: number; children?: number
    name: string; phone: string; contactVia?: ContactVia; comment?: string; picks?: ExtraPick[]; createdMinAgo: number
    notes?: { type: 'call' | 'note'; text: string; minAgo: number }[]
  }

  const leads: SeedLead[] = [
    { unit: 'kantri', status: 'new', occasion: 'День рождения', from: 13, nights: 2, guests: 12, children: 2, name: 'Ольга Савицкая', phone: '+375 29 611-24-80', contactVia: 'telegram', comment: 'Хотим баню в субботу вечером и конную прогулку для взрослых. Можно ли свою колонку?', picks: [ex('Баня на дровах'), ex('Дополнительный час'), ex('Веник', 2), ex('Конная прогулка, 1 час', 6)], createdMinAgo: 18 },
    { unit: 'shale', status: 'new', occasion: 'Отдых вдвоём', from: 9, nights: 1, guests: 2, name: 'Максим', phone: '+375 44 702-15-33', comment: 'Годовщина, хотим тихий вечер у камина', picks: [ex('Баня на дровах'), ex('Конная прогулка, 1 час', 2)], createdMinAgo: 95 },
    { unit: 'kantri', status: 'new', occasion: 'Корпоратив', from: 24, nights: 1, guests: 15, name: 'Ирина, ООО «Северный ветер»', phone: '+375 29 380-44-12', comment: 'Корпоратив отдела, нужен обед на всех и счёт на юрлицо', picks: [ex('Обед на гриле', 15), ex('Конная прогулка, 30', 15)], createdMinAgo: 60 * 5 },
    {
      unit: 'shale', status: 'contacted', occasion: 'Выходные с друзьями', from: 6, nights: 2, guests: 8, name: 'Денис', phone: '+375 33 615-90-02', picks: [ex('Баня на дровах'), ex('Подготовка мангала')], createdMinAgo: 60 * 26,
      notes: [{ type: 'call', text: 'Созвонились: 8 взрослых, будут с лабрадором — согласовали, +30 BYN. Задаток переведёт до пятницы.', minAgo: 60 * 22 }],
    },
    { unit: 'kantri', status: 'booked', occasion: 'Выходные семьёй', from: 2, nights: 2, guests: 10, children: 4, name: 'Семья Ковалёвых', phone: '+375 29 117-62-45', picks: [ex('Баня на дровах', 2), ex('Конная прогулка, 30', 6)], createdMinAgo: 60 * 24 * 12 },
    { unit: 'shale', status: 'booked', occasion: 'День рождения', from: 13, nights: 1, guests: 12, name: 'Анастасия', phone: '+375 44 559-71-20', picks: [ex('Подготовка мангала'), ex('Гость без ночлега', 4)], createdMinAgo: 60 * 24 * 20 },
    { unit: 'kantri', status: 'booked', occasion: 'Отдых большой компанией', from: 30, nights: 3, guests: 14, name: 'Компания Андрея', phone: '+375 29 744-03-81', createdMinAgo: 60 * 24 * 35 },
    { unit: 'shale', status: 'done', occasion: 'Отдых вдвоём', from: -5, nights: 1, guests: 2, name: 'Виктория', phone: '+375 33 920-48-11', picks: [ex('Баня на дровах'), ex('Блинчики', 2)], createdMinAgo: 60 * 24 * 9 },
    { unit: 'kantri', status: 'done', occasion: 'Корпоратив', from: -10, nights: 1, guests: 14, name: 'IT-отдел «Пиксель»', phone: '+375 29 501-77-36', picks: [ex('Обед на гриле', 14)], createdMinAgo: 60 * 24 * 25 },
    { unit: 'kantri', status: 'lost', occasion: 'Выпускной', from: 40, nights: 1, guests: 15, name: 'Олег', phone: '+375 29 260-18-54', createdMinAgo: 60 * 24 * 3, notes: [{ type: 'note', text: 'Хотели 25 человек с ночёвкой — в один дом не помещаются, предложили оба дома. Отказались.', minAgo: 60 * 24 * 2 }] },
  ]

  for (const l of leads) {
    const checkIn = addDays(T, l.from)
    const checkOut = addDays(T, l.from + l.nights)
    const u = l.unit ? units[l.unit] : null
    // Заявку считаем по тому дню, когда она «пришла»
    const createdAt = minutesAgo(l.createdMinAgo)
    const q = u
      ? quote({ unit: u.unit, rates: u.rates, extras, picks: l.picks ?? [], checkIn, checkOut, guests: l.guests, holidays: HOLIDAYS, today: createdAt.toISOString().slice(0, 10) })
      : null
    await prisma.lead.create({
      data: {
        propertyId: property.id,
        unitId: u?.id ?? null,
        status: l.status,
        occasion: l.occasion,
        checkIn: toDate(checkIn),
        checkOut: toDate(checkOut),
        guests: l.guests,
        children: l.children ?? 0,
        name: l.name,
        phone: l.phone,
        contactVia: l.contactVia ?? 'call',
        comment: l.comment,
        extras: l.picks ?? [],
        quote: q ?? undefined,
        estimate: q?.ok ? q.total : null,
        createdAt,
        contactedAt: l.status === 'new' ? null : minutesAgo(l.createdMinAgo - 40),
        events: {
          create: [
            { type: 'created', text: 'Заявка с сайта', createdAt },
            ...(l.notes ?? []).map((e) => ({ type: e.type, text: e.text, userId: admin.id, createdAt: minutesAgo(e.minAgo) })),
            ...(l.status === 'booked' || l.status === 'done'
              ? [{ type: 'status' as const, text: 'Задаток получен — бронь подтверждена', userId: admin.id, createdAt: minutesAgo(l.createdMinAgo - 180) }]
              : []),
          ],
        },
      },
    })
  }

  // Занятость, пришедшая из внешних календарей и закрытая вручную
  const kufar = await prisma.calendarFeed.create({
    data: { unitId: units.kantri.id, label: 'Куфар', url: 'https://example.com/demo-kufar.ics', lastSyncAt: minutesAgo(12) },
  })
  await prisma.block.create({ data: { unitId: units.kantri.id, start: day(7), end: day(9), reason: 'Бронь с Куфара', feedId: kufar.id, externalId: 'demo-1' } })
  const google = await prisma.calendarFeed.create({
    data: { unitId: units.shale.id, label: 'Google', url: 'https://example.com/demo-google.ics', lastSyncAt: minutesAgo(12) },
  })
  await prisma.block.create({ data: { unitId: units.shale.id, start: day(20), end: day(22), reason: 'Свои гости', feedId: google.id, externalId: 'demo-2' } })
  await prisma.block.create({ data: { unitId: units.shale.id, start: day(16), end: day(17), reason: 'Чистка дымохода' } })

  console.log('Усадьба «Буцевичи» создана. Вход: demo@zaezd.by / demo')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
