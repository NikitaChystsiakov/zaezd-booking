import Link from 'next/link'
import { ArrowRight, CalendarSync, ClipboardList, FileText, Lock, ShieldCheck, Users } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { demoLogin } from '@/app/login/actions'

const AUTHOR = 'Никита'

const STEPS = [
  {
    n: '01',
    title: 'Заявка уже посчитана',
    text: 'Гость на сайте выбирает дом, даты, компанию и допуслуги. Цена считается по тарифам площадки: будни, выходные, сезоны, доплата за гостей.',
  },
  {
    n: '02',
    title: 'Карточка звонка',
    text: 'Администратор видит всё до звонка: повод, состав, пересечения с другими бронями и подсказки, о чём сказать. Звонок — 5 минут, а не 30.',
  },
  {
    n: '03',
    title: 'Живое КП за минуту',
    text: 'После разговора — ссылка с вариантами «Базовый / Оптимум / Всё включено». Видно, когда гость открыл предложение: самое время перезвонить.',
  },
  {
    n: '04',
    title: 'Компания скидывается сама',
    text: 'Организатор кидает ссылку в чат друзей, каждый отмечает свою долю предоплаты. Администратор подтверждает поступления — и даты закреплены.',
  },
]

const FEATURES = [
  { icon: Lock, title: 'Последнее слово за владельцем', text: 'Скрыть занятость, показать цену «от» или не показывать вовсе — настраивается. Система готовит звонок, а не заменяет его.' },
  { icon: CalendarSync, title: 'Куфар, Реалт, Google', text: 'Синхронизация занятости через iCal в обе стороны: брони с площадок попадают в календарь, наши — к ним.' },
  { icon: ShieldCheck, title: 'Двойная бронь невозможна', text: 'Пересечение дат запрещено ограничением в самой базе данных — даже если два администратора нажмут «Бронь» одновременно.' },
  { icon: ClipboardList, title: 'Ни одна заявка не теряется', text: 'Обещанное время перезвона, подсветка просроченных заявок, история звонков и уведомления в Telegram.' },
  { icon: Users, title: 'Под группы и события', text: 'Дни рождения, корпоративы, свадьбы: дома с доплатой за гостей, площадки на день, допуслуги за заезд, ночь или человека.' },
  { icon: FileText, title: 'Цены меняет сам владелец', text: 'Тарифы, сезоны и допуслуги — в панели. Изменения сразу на сайте и в новых расчётах.' },
]

const TECH = [
  ['Next.js 16 · React 19 · TypeScript', 'Server Components и Server Actions, без отдельного API-слоя'],
  ['PostgreSQL · Prisma', 'Exclusion constraint по диапазону дат против двойной брони'],
  ['Расчёт цены — чистая функция', 'Один код для сайта, админки и КП, покрыт тестами (Vitest)'],
  ['iCalendar (RFC 5545)', 'Своя реализация экспорта и разбора лент'],
  ['Мультиарендность', 'Каждая площадка видит только свои данные; доступ проверяется в каждом действии'],
  ['Tailwind CSS 4', 'Дизайн-токены, светлая и тёмная тема'],
]

export default function Home() {
  return (
    <div className="overflow-x-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <Link href="/login" className="text-sm text-ink-2 hover:text-ink">
          Вход
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:pt-20">
        <p className="eyebrow mb-5">Для усадеб и загородных площадок</p>
        <h1 className="max-w-4xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Вопрос «сколько на 20 человек?» — <span className="text-accent">в предоплату</span>, без потерянных заявок
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-ink-2">
          Гуртом — второй пилот администратора. Заявка приходит уже посчитанной, к звонку всё известно, через минуту после разговора у гостя
          живое предложение, а компания сама скидывается на предоплату.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/u/sosnovy-brod" className="btn-primary h-12 px-6 text-base">
            Сайт демо-усадьбы <ArrowRight size={17} />
          </Link>
          <form action={demoLogin}>
            <button className="btn-ghost h-12 px-6 text-base">Админка демо</button>
          </form>
        </div>
        <p className="mt-4 text-sm text-ink-3">Оставьте заявку на сайте усадьбы — и посмотрите, как она выглядит у администратора.</p>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-px px-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="py-10 sm:pr-8">
              <div className="font-serif text-3xl italic text-accent">{s.n}</div>
              <h2 className="mt-4 text-lg font-semibold">{s.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="max-w-2xl text-3xl font-semibold tracking-tight">Сделано вокруг того, как площадки работают на самом деле</h2>
        <p className="mt-3 max-w-2xl text-ink-2">
          Владельцы хотят сами созваниваться с гостями и не показывать занятость всем подряд. Поэтому здесь нет «купить в один клик» — есть
          инструменты, чтобы звонок закрывался в бронь.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="card p-6">
              <Icon size={20} className="text-accent" />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <p className="eyebrow !text-paper/50">Как устроено</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Под капотом</h2>
          <dl className="mt-10 grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {TECH.map(([t, d]) => (
              <div key={t} className="border-t border-paper/15 pt-4">
                <dt className="font-medium">{t}</dt>
                <dd className="mt-1 text-sm text-paper/60">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-10 text-sm text-ink-3">
        <Logo />
        <span>Дизайн и разработка — {AUTHOR}, 2026</span>
      </footer>
    </div>
  )
}
