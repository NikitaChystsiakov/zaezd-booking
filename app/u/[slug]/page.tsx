import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapPin, Phone, Users } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { todayISO, toISO } from '@/lib/dates'
import { busyNights } from '@/lib/availability'
import { toQuoteExtras, toQuoteRates, UNIT_KIND_LABEL } from '@/lib/domain'
import { formatMoney } from '@/lib/quote'
import { BookingWidget } from '@/components/BookingWidget'
import { DemoModeBar } from '@/components/DemoModeBar'

const DEMO_SLUG = 'sosnovy-brod'

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const p = await prisma.property.findUnique({ where: { slug }, select: { name: true, tagline: true } })
  return p ? { title: p.name, description: p.tagline ?? undefined, robots: { index: false } } : {}
}

export default async function PropertyPage({ params, searchParams }: Params) {
  const { slug } = await params
  const sp = await searchParams
  const property = await prisma.property.findUnique({
    where: { slug },
    include: {
      units: { where: { active: true }, orderBy: { sortOrder: 'asc' }, include: { rates: true } },
      extras: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
    },
  })
  if (!property) notFound()

  // На демо режимы можно переключать из панели сверху, на настоящих площадках — только в админке
  const isDemo = slug === DEMO_SLUG
  const showAvailability = isDemo && sp.avail ? sp.avail === '1' : property.showAvailability
  const priceMode = isDemo && sp.price && ['exact', 'from', 'hidden'].includes(sp.price) ? (sp.price as 'exact' | 'from' | 'hidden') : property.priceMode

  const today = todayISO(property.timezone)
  const busy = showAvailability ? await busyNights(property.id, today, 180) : null

  const units = property.units.map((u) => ({
    id: u.id,
    name: u.name,
    kind: u.kind,
    capacity: u.capacity,
    baseGuests: u.baseGuests,
    rates: toQuoteRates(u.rates).map((r) => ({
      ...r,
      startDate: r.startDate ? toISO(r.startDate as Date) : null,
      endDate: r.endDate ? toISO(r.endDate as Date) : null,
    })),
  }))
  const extras = toQuoteExtras(property.extras).map((e, i) => ({ ...e, description: property.extras[i].description }))

  return (
    <div className="bg-[#f3efe6] text-[#1f2622] [--paper:#f3efe6] [--surface:#fffdf8] [--surface-2:#ece6da] [--line:#ddd5c5] [--line-strong:#c9bfac] [--ink:#1f2622] [--ink-2:#4e564f] [--ink-3:#858a80] [--accent:#1f5f6b] [--accent-soft:#d9e7e6] [--accent-ink:#ffffff] [--ok:#2f7a4b] [--ok-soft:#dfece2] [--warn:#99600f] [--warn-soft:#f3e6cf] [color-scheme:light]">
      {isDemo && <DemoModeBar showAvailability={showAvailability} priceMode={priceMode} />}

      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <div className="font-serif text-xl italic">{property.name}</div>
        <nav className="hidden gap-6 text-sm text-ink-2 sm:flex">
          <a href="#houses" className="hover:text-ink">Дома и шатёр</a>
          <a href="#booking" className="hover:text-ink">Заявка</a>
        </nav>
        {property.phone && (
          <a href={`tel:${property.phone.replace(/\s/g, '')}`} className="flex items-center gap-2 text-sm font-medium">
            <Phone size={15} /> <span className="hidden sm:inline">{property.phone}</span>
          </a>
        )}
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-14 pt-6 sm:pt-12">
        <p className="eyebrow mb-4 flex items-center gap-2">
          <MapPin size={13} /> {property.address}
        </p>
        <h1 className="max-w-3xl font-serif text-4xl leading-[1.08] sm:text-6xl">
          {property.tagline}
        </h1>
        <p className="mt-6 max-w-xl text-lg text-ink-2">{property.description}</p>
        <a href="#booking" className="btn-primary mt-8 h-12 px-6 text-base">
          Оставить заявку
        </a>
      </section>

      <section id="houses" className="mx-auto max-w-6xl px-4 pb-20">
        <div className="grid gap-4 sm:grid-cols-2">
          {property.units.map((u) => {
            const min = Math.min(...u.rates.map((r) => r.pricePerNight))
            return (
              <article key={u.id} className="card overflow-hidden">
                {u.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.photo} alt="" className="aspect-[3/2] w-full object-cover" />
                )}
                <div className="p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="font-serif text-2xl">{u.name}</h2>
                    <span className="text-xs text-ink-3">{UNIT_KIND_LABEL[u.kind]}</span>
                  </div>
                  <p className="mt-2 text-sm text-ink-2">{u.description}</p>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-ink-2">
                      <Users size={15} /> до {u.capacity} гостей
                    </span>
                    {priceMode !== 'hidden' && (
                      <span className="font-medium">
                        от {formatMoney(min)} <span className="font-normal text-ink-3">/ {u.kind === 'venue' ? 'день' : 'ночь'}</span>
                      </span>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section id="booking" className="scroll-mt-14 border-t border-line bg-[#ebe5d8] py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-serif text-3xl sm:text-4xl">Заявка на отдых</h2>
          <p className="mb-8 mt-3 max-w-xl text-ink-2">
            Расскажите о компании — администратор свяжется с вами, ответит на вопросы и пришлёт точное предложение.
          </p>
          <BookingWidget
            slug={property.slug}
            propertyName={property.name}
            priceMode={priceMode}
            callbackMinutes={property.callbackMinutes}
            today={today}
            units={units}
            extras={extras}
            busy={busy}
          />
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 px-4 py-8 text-xs text-ink-3">
        <span>© {property.name} — вымышленная усадьба для демонстрации</span>
        <Link href="/" className="hover:text-ink">Работает на Гуртом</Link>
      </footer>
    </div>
  )
}
