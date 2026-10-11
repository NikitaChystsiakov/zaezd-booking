import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'
import { PageHeader } from '@/components/admin/ui'
import { PropertyForm } from '@/components/admin/PropertyForm'

export const metadata: Metadata = { title: 'Тексты и фото' }

export default async function PropertyPage() {
  const session = await requireSession()
  const p = await prisma.property.findUniqueOrThrow({ where: { id: session.propertyId } })

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Тексты и фото" sub="Что гость видит на странице бронирования: первый экран, контакты, условия. Тексты домов — в «Дома и тарифы»." />
      <PropertyForm
        slug={p.slug}
        heroPhoto={p.heroPhoto}
        initial={{
          name: p.name,
          kind: p.kind ?? '',
          tagline: p.tagline ?? '',
          description: p.description ?? '',
          address: p.address ?? '',
          phone: p.phone ?? '',
          phone2: p.phone2 ?? '',
          email: p.email ?? '',
          instagram: p.instagram ?? '',
          checkInTime: p.checkInTime,
          checkOutTime: p.checkOutTime,
          bookingTerms: p.bookingTerms ?? '',
          holidays: p.holidays,
        }}
      />
    </div>
  )
}
