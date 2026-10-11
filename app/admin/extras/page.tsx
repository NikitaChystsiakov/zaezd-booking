import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'
import { PageHeader } from '@/components/admin/ui'
import { ExtrasEditor } from '@/components/admin/ExtrasEditor'

export const metadata: Metadata = { title: 'Услуги' }

export default async function ExtrasPage() {
  const session = await requireSession()
  const extras = await prisma.extra.findMany({ where: { propertyId: session.propertyId }, orderBy: { sortOrder: 'asc' } })

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Услуги" sub="Баня, прогулки, еда — гость добавляет их к брони, и они сразу входят в расчёт." />
      <ExtrasEditor
        extras={extras.map((e) => ({
          id: e.id,
          name: e.name,
          description: e.description ?? '',
          group: e.group ?? '',
          priceType: e.priceType,
          price: e.price,
          unitLabel: e.unitLabel ?? '',
          maxQty: e.maxQty,
          active: e.active,
        }))}
      />
    </div>
  )
}
