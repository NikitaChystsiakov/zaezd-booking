import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, AtSign, Clock, MapPin, Phone, Users } from 'lucide-react'
import { loadPublicProperty } from '@/lib/publicProperty'
import { weekdaysLabel } from '@/lib/domain'
import { formatMoney } from '@/lib/quote'
import { plural } from '@/lib/dates'
import { BookingWidget } from '@/components/BookingWidget'

const DEMO_SLUG = 'butsevichi'

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ dom?: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const data = await loadPublicProperty(slug)
  if (!data) return {}
  const { property } = data
  return { title: `Бронирование — ${property.kind ? `${property.kind} ` : ''}«${property.name}»`, description: property.description ?? undefined }
}

export default async function PropertyPage({ params, searchParams }: Params) {
  const { slug } = await params
  const { dom } = await searchParams
  const data = await loadPublicProperty(slug)
  if (!data) notFound()
  const { property, today, busy, units, extras } = data

  const totalCapacity = property.units.reduce((s, u) => s + u.capacity, 0)
  const terms = (property.bookingTerms ?? '').split('\n').map((t) => t.trim()).filter(Boolean)
  const initialUnit = property.units.find((u) => u.slug === dom)?.id
  const showPrices = property.priceMode !== 'hidden'
  const tel = (p: string) => `tel:${p.replace(/[^\d+]/g, '')}`

  return (
    <div className="theme-forest bg-forest-deep text-linen">
      {slug === DEMO_SLUG && (
        <div className="border-b border-white/10 bg-black/40 text-[13px]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 sm:px-8">
            <span className="text-linen/70">Демо модуля бронирования на данных усадьбы «Буцевичи»</span>
            <Link href="/admin" className="ml-auto inline-flex items-center gap-1.5 font-semibold text-brass-pale hover:text-linen">
              Панель администратора <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}

      {/* Первый экран */}
      <header className="relative isolate overflow-hidden">
        {property.heroPhoto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={property.heroPhoto} alt="" className="photo-grade absolute inset-0 -z-20 size-full object-cover" />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-forest-deep/70 via-forest-deep/40 to-forest-deep" />
        <div className="grain pointer-events-none absolute inset-0 -z-10" />

        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-8">
          <div>
            {property.kind && <div className="eyebrow text-brass-pale">{property.kind}</div>}
            <div className="display text-[30px] leading-none">{property.name}</div>
          </div>
          <div className="hidden items-center gap-8 text-sm text-linen/80 md:flex">
            <a href="#doma" className="hover:text-linen">Дома</a>
            <a href="#bron" className="hover:text-linen">Бронирование</a>
            <a href="#usloviya" className="hover:text-linen">Условия</a>
          </div>
          {property.phone && (
            <a href={tel(property.phone)} className="inline-flex h-10 items-center gap-2 rounded-full border border-linen/30 px-4 text-sm font-semibold hover:bg-linen/10">
              <Phone size={15} /> <span className="hidden sm:inline">{property.phone}</span>
            </a>
          )}
        </nav>

        <div className="mx-auto max-w-7xl px-4 pt-[18vh] pb-14 sm:px-8 sm:pb-20">
          <p className="eyebrow mb-5 text-brass-pale">Проживание и бронирование</p>
          <h1 className="display max-w-4xl text-[52px] sm:text-[88px] lg:text-[112px]">{property.tagline}</h1>
          {property.description && <p className="mt-6 max-w-xl text-lg leading-relaxed text-linen/80">{property.description}</p>}
          <div className="mt-9 flex flex-wrap gap-3">
            <a href="#bron" className="inline-flex h-[52px] items-center gap-2 rounded-full bg-linen px-7 text-[15px] font-semibold text-forest-deep hover:bg-white">
              Выбрать даты <ArrowRight size={17} />
            </a>
            <a href="#doma" className="inline-flex h-[52px] items-center rounded-full border border-linen/40 px-7 text-[15px] font-semibold hover:bg-linen/10">
              Посмотреть дома
            </a>
          </div>

          <dl className="mt-14 grid max-w-3xl grid-cols-2 gap-x-8 gap-y-5 border-t border-linen/15 pt-6 sm:grid-cols-4">
            <Fact label={plural(property.units.length, 'дом', 'дома', 'домов')} value={String(property.units.length)} />
            <Fact label="гостей с ночлегом" value={`до ${totalCapacity}`} />
            <Fact label={`заезд, выезд до ${property.checkOutTime}`} value={`с ${property.checkInTime}`} />
            <Fact label="задаток для брони" value={`${property.depositPercent}%`} />
          </dl>
        </div>
      </header>

      {/* Дома */}
      <section id="doma" className="scroll-mt-4 bg-forest py-20 sm:py-28">
        <div className="mx-auto max-w-7xl space-y-24 px-4 sm:space-y-32 sm:px-8">
          {property.units.map((u, i) => {
            const whole = u.rates.filter((r) => r.maxGuests === null)
            const small = u.rates.filter((r) => r.maxGuests !== null)
            const minPrice = Math.min(...u.rates.map((r) => r.pricePerNight))
            return (
              <article key={u.id} className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${i % 2 ? 'lg:[&>*:first-child]:order-2' : ''}`}>
                <div className="grid grid-cols-[1.4fr_1fr] gap-3">
                  {u.photos[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.photos[0]} alt={`${u.name} снаружи`} className="photo-grade arch row-span-2 aspect-[3/4] size-full object-cover" />
                  )}
                  {u.photos.slice(1, 3).map((p, j) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={p} src={p} alt={`${u.name}, фото ${j + 2}`} className="photo-grade aspect-square size-full rounded-[14px] object-cover" />
                  ))}
                </div>

                <div>
                  <p className="eyebrow text-brass-pale">{u.summary}</p>
                  <h2 className="display mt-3 text-[56px] sm:text-[72px]">{u.name}</h2>
                  {u.description && <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-linen/80">{u.description}</p>}
                  <ul className="mt-6 flex flex-wrap gap-2">
                    {u.amenities.map((a) => (
                      <li key={a} className="rounded-full border border-linen/20 px-3.5 py-1.5 text-[13px] text-linen/85">
                        {a}
                      </li>
                    ))}
                  </ul>

                  {showPrices && (
                    <div className="mt-8 rounded-[20px] border border-linen/15 bg-forest-deep/50 p-5 sm:p-6">
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="eyebrow text-linen/60">Стоимость ночи</span>
                        <span className="text-[13px] text-linen/60">заезд {property.checkInTime}, выезд {property.checkOutTime}</span>
                      </div>
                      <dl className="mt-4 grid gap-x-8 gap-y-2.5 text-[15px] sm:grid-cols-2">
                        {whole.map((r) => (
                          <div key={r.id} className="flex items-baseline justify-between gap-3 border-b border-linen/10 pb-2.5">
                            <dt className="text-linen/75">{r.holidaysOnly ? 'праздники' : weekdaysLabel(r.weekdays)}</dt>
                            <dd className="font-semibold tabular-nums">{formatMoney(r.pricePerNight)}</dd>
                          </div>
                        ))}
                      </dl>
                      <p className="mt-3 text-[13px] leading-relaxed text-linen/60">
                        Весь дом до {whole[0]?.includedGuests} гостей
                        {whole[0]?.extraGuestPrice ? `, каждый следующий +${whole[0].extraGuestPrice} BYN` : ''}.
                        {small[0] &&
                          ` Компании до ${small[0].maxGuests} человек в другие дни — от ${small[0].pricePerNight} BYN за двоих, +${small[0].extraGuestPrice} за гостя; открываем лишние спальни по числу гостей.`}
                        {u.longStayFromNight && u.longStayPercent > 0 && ` С ${u.longStayFromNight}-й ночи — скидка ${u.longStayPercent}%.`}
                      </p>
                    </div>
                  )}

                  <a href={`?dom=${u.slug}#bron`} className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-linen px-6 text-[15px] font-semibold text-forest-deep hover:bg-white">
                    Забронировать {u.name.replace('Дом ', '')} {showPrices && <span className="font-normal text-forest/60">от {minPrice} BYN</span>}
                  </a>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {/* Бронирование */}
      <section id="bron" className="scroll-mt-4 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow text-brass-pale">Онлайн-заявка</p>
              <h2 className="display mt-3 text-[56px] sm:text-[80px]">Бронирование</h2>
            </div>
            <p className="max-w-md text-[15px] leading-relaxed text-linen/70">
              Выберите дом и даты — стоимость посчитается сразу. После заявки администратор свяжется с вами, подтвердит даты и расскажет, как внести задаток.
            </p>
          </div>
          <BookingWidget
            slug={property.slug}
            priceMode={property.priceMode}
            depositPercent={property.depositPercent}
            callbackMinutes={property.callbackMinutes}
            today={today}
            holidays={property.holidays}
            units={units}
            extras={extras}
            busy={busy}
            phone={property.phone}
            initialUnitId={initialUnit}
          />
        </div>
      </section>

      {/* Условия */}
      {terms.length > 0 && (
        <section id="usloviya" className="scroll-mt-4 bg-linen py-20 text-forest sm:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-8 lg:grid-cols-[1fr_2fr]">
            <div>
              <p className="eyebrow text-saddle">Перед бронированием</p>
              <h2 className="display mt-3 text-[56px] sm:text-[72px]">Условия</h2>
            </div>
            <ol className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
              {terms.map((t, i) => (
                <li key={i} className="border-t border-forest/15 pt-4">
                  <div className="display text-[22px] text-saddle italic">{String(i + 1).padStart(2, '0')}</div>
                  <p className="mt-2 text-[15px] leading-relaxed text-forest/80">{t}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      <footer className="border-t border-linen/10 py-14">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-8 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            {property.kind && <div className="eyebrow text-brass-pale">{property.kind}</div>}
            <div className="display text-[40px]">{property.name}</div>
            {property.tagline && <p className="mt-2 text-linen/60">{property.tagline}</p>}
          </div>
          <div className="space-y-2.5 text-[15px]">
            {[property.phone, property.phone2].filter(Boolean).map((p) => (
              <a key={p} href={tel(p!)} className="flex items-center gap-2.5 hover:text-brass-pale">
                <Phone size={15} className="text-brass-hi" /> {p}
              </a>
            ))}
            {property.email && (
              <a href={`mailto:${property.email}`} className="flex items-center gap-2.5 hover:text-brass-pale">
                <AtSign size={15} className="text-brass-hi" /> {property.email}
              </a>
            )}
            {property.instagram && (
              <a href={`https://instagram.com/${property.instagram}`} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 hover:text-brass-pale">
                <span className="w-[15px] text-center text-brass-hi">@</span> {property.instagram}
              </a>
            )}
          </div>
          <div className="space-y-2.5 text-[15px] text-linen/75">
            {property.address && (
              <p className="flex gap-2.5">
                <MapPin size={15} className="mt-1 shrink-0 text-brass-hi" /> {property.address}
              </p>
            )}
            <p className="flex gap-2.5">
              <Clock size={15} className="mt-1 shrink-0 text-brass-hi" /> Заезд с {property.checkInTime}, выезд до {property.checkOutTime}
            </p>
            <p className="flex gap-2.5">
              <Users size={15} className="mt-1 shrink-0 text-brass-hi" /> Только по предварительной записи
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dd className="text-[28px] leading-none font-semibold tracking-tight whitespace-nowrap">{value}</dd>
      <dt className="mt-1.5 text-[13px] text-linen/65">{label}</dt>
    </div>
  )
}
