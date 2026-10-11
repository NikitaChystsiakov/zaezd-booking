import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'
import { PRICE_TYPE_LABEL, UNIT_KIND_LABEL } from '@/lib/domain'
import { toISO } from '@/lib/dates'
import { RateRow } from '@/components/admin/RateRow'
import { ExtraRow } from '@/components/admin/ExtraRow'

export const metadata: Metadata = { title: 'Цены и услуги' }

const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

function rateWhen(r: { startDate: Date | null; endDate: Date | null; weekdays: number[] }): string {
  const parts: string[] = []
  if (r.startDate || r.endDate) parts.push(`${r.startDate ? toISO(r.startDate) : '…'} — ${r.endDate ? toISO(r.endDate) : '…'}`)
  if (r.weekdays.length) parts.push(r.weekdays.map((d) => WD[d]).join(', '))
  return parts.join(' · ') || 'Любой день'
}

export default async function PricesPage() {
  const session = await requireSession()
  const [units, extras] = await Promise.all([
    prisma.unit.findMany({
      where: { propertyId: session.propertyId },
      orderBy: { sortOrder: 'asc' },
      include: { rates: { orderBy: { priority: 'desc' } } },
    }),
    prisma.extra.findMany({ where: { propertyId: session.propertyId }, orderBy: { sortOrder: 'asc' } }),
  ])

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold">Цены и услуги</h1>
      <p className="mb-8 mt-1 text-sm text-ink-2">
        Для каждой ночи берётся самый «сильный» тариф: новогодний важнее выходного, выходной важнее будничного. Изменения сразу видны на сайте и в новых расчётах.
      </p>

      <div className="space-y-6">
        {units.map((u) => (
          <section key={u.id} className="card overflow-hidden">
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-4">
              <div>
                <h2 className="font-semibold">{u.name}</h2>
                <p className="text-xs text-ink-3">
                  {UNIT_KIND_LABEL[u.kind]} · до {u.capacity} гостей · в базовую цену входит {u.baseGuests}
                </p>
              </div>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-xs text-ink-3">
                  <tr>
                    <th className="px-5 py-2 font-medium">Тариф</th>
                    <th className="px-2 py-2 font-medium">Когда действует</th>
                    <th className="px-2 py-2 font-medium">{u.kind === 'venue' ? 'За день' : 'За ночь'}</th>
                    <th className="px-2 py-2 font-medium">{u.kind === 'venue' ? '' : 'Гость сверх базы'}</th>
                    <th className="px-5 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {u.rates.map((r) => (
                    <RateRow
                      key={r.id}
                      id={r.id}
                      name={r.name}
                      when={rateWhen(r)}
                      price={r.pricePerNight}
                      extraGuest={r.extraGuestPrice}
                      showExtraGuest={u.kind !== 'venue'}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        <section className="card overflow-hidden">
          <header className="border-b border-line px-5 py-4">
            <h2 className="font-semibold">Дополнительные услуги</h2>
            <p className="text-xs text-ink-3">Гость отмечает их в заявке, вы — включаете в варианты КП</p>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <tbody className="divide-y divide-line">
                {extras.map((e) => (
                  <ExtraRow key={e.id} id={e.id} name={e.name} description={e.description} unit={PRICE_TYPE_LABEL[e.priceType]} price={e.price} active={e.active} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
