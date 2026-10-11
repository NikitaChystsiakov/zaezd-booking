import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'
import { todayISO, toISO } from '@/lib/dates'
import { toQuoteExtras } from '@/lib/domain'
import { UnitForm } from '@/components/admin/UnitForm'
import { PhotoManager } from '@/components/admin/PhotoManager'
import { RatesEditor, type RateRow } from '@/components/admin/RatesEditor'
import { PriceCheck } from '@/components/admin/PriceCheck'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const u = await prisma.unit.findUnique({ where: { id }, select: { name: true } })
  return { title: u?.name ?? 'Дом' }
}

export default async function UnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireSession()
  const unit = await prisma.unit.findFirst({
    where: { id, propertyId: session.propertyId },
    include: { rates: { orderBy: [{ sortOrder: 'asc' }] }, property: { include: { extras: { where: { active: true }, orderBy: { sortOrder: 'asc' } } } } },
  })
  if (!unit) notFound()

  const rates: RateRow[] = unit.rates.map((r) => ({
    id: r.id,
    name: r.name,
    weekdays: r.weekdays,
    holidaysOnly: r.holidaysOnly,
    startDate: r.startDate ? toISO(r.startDate) : null,
    endDate: r.endDate ? toISO(r.endDate) : null,
    minGuests: r.minGuests,
    maxGuests: r.maxGuests,
    includedGuests: r.includedGuests,
    pricePerNight: r.pricePerNight,
    extraGuestPrice: r.extraGuestPrice,
    bookableWithinDays: r.bookableWithinDays,
    priority: r.priority,
  }))

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/admin/units" className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft size={15} /> Дома и тарифы
      </Link>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className={`chip ${unit.active ? 'bg-ok-soft text-ok' : 'bg-muted-soft text-ink-2'}`}>{unit.active ? 'Показан на сайте' : 'Скрыт с сайта'}</span>
          <h1 className="display mt-3 text-[44px] sm:text-[52px]">{unit.name}</h1>
        </div>
        <a href={`/u/${unit.property.slug}?dom=${unit.slug}#doma`} target="_blank" className="btn-ghost btn-sm">
          Как видит гость <ArrowUpRight size={14} />
        </a>
      </div>

      <div className="space-y-6">
        <PhotoManager unitId={unit.id} photos={unit.photos} />
        <UnitForm
          unitId={unit.id}
          initial={{
            name: unit.name,
            summary: unit.summary ?? '',
            description: unit.description ?? '',
            capacity: unit.capacity,
            amenities: unit.amenities,
            longStayFromNight: unit.longStayFromNight,
            longStayPercent: unit.longStayPercent,
            active: unit.active,
          }}
        />
        <RatesEditor unitId={unit.id} capacity={unit.capacity} rates={rates} />
        <PriceCheck
          unit={{ name: unit.name, capacity: unit.capacity, longStayFromNight: unit.longStayFromNight, longStayPercent: unit.longStayPercent }}
          rates={rates}
          extras={toQuoteExtras(unit.property.extras)}
          holidays={unit.property.holidays}
          today={todayISO(unit.property.timezone)}
        />
      </div>
    </div>
  )
}
