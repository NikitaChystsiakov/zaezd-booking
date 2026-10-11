import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowRight, ImageOff } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'
import { formatMoney } from '@/lib/quote'
import { plural } from '@/lib/dates'
import { PageHeader } from '@/components/admin/ui'
import { NewUnitForm } from '@/components/admin/NewUnitForm'

export const metadata: Metadata = { title: 'Дома и тарифы' }

export default async function UnitsPage() {
  const session = await requireSession()
  const units = await prisma.unit.findMany({
    where: { propertyId: session.propertyId },
    orderBy: { sortOrder: 'asc' },
    include: { rates: { select: { pricePerNight: true } }, _count: { select: { leads: { where: { status: 'booked' } } } } },
  })

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Дома и тарифы" sub="Описание, фото и цены каждого дома. Всё, что здесь, сразу видно на странице бронирования." />

      <div className="grid gap-5 md:grid-cols-2">
        {units.map((u) => {
          const prices = u.rates.map((r) => r.pricePerNight)
          return (
            <Link key={u.id} href={`/admin/units/${u.id}`} className="card group overflow-hidden transition-shadow hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,.25)]">
              <div className="relative aspect-[16/9] bg-surface-2">
                {u.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.photos[0]} alt="" className="photo-grade size-full object-cover" />
                ) : (
                  <div className="grid size-full place-items-center text-ink-3">
                    <ImageOff size={28} />
                  </div>
                )}
                <span className={`chip absolute top-3 left-3 ${u.active ? 'bg-surface/90 text-ink' : 'bg-ink text-surface'}`}>{u.active ? 'Показан на сайте' : 'Скрыт'}</span>
              </div>
              <div className="flex items-end justify-between gap-4 p-6">
                <div>
                  <h2 className="display text-[32px]">{u.name}</h2>
                  <p className="mt-1 text-sm text-ink-2">{u.summary ?? 'Без описания'}</p>
                  <p className="mt-3 text-[13px] text-ink-3">
                    до {u.capacity} гостей · {u.rates.length} {plural(u.rates.length, 'тариф', 'тарифа', 'тарифов')}
                    {prices.length > 0 && ` · ${formatMoney(Math.min(...prices))} — ${formatMoney(Math.max(...prices))}`}
                    {u._count.leads > 0 && ` · ${u._count.leads} ${plural(u._count.leads, 'бронь', 'брони', 'броней')}`}
                  </p>
                </div>
                <ArrowRight size={20} className="mb-1 shrink-0 text-ink-3 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          )
        })}
        <NewUnitForm />
      </div>
    </div>
  )
}
