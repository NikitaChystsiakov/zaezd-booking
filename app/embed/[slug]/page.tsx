import { notFound } from 'next/navigation'
import { loadPublicProperty } from '@/lib/publicProperty'
import { BookingWidget } from '@/components/BookingWidget'
import { EmbedHeight } from '@/components/EmbedHeight'

// Только форма бронирования — для вставки на сайт усадьбы через /embed.js
export default async function EmbedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await loadPublicProperty(slug)
  if (!data) notFound()
  const { property, today, busy, units, extras } = data

  return (
    <div className={`theme-${property.theme} min-h-0 bg-transparent p-1`}>
      <EmbedHeight />
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
      />
    </div>
  )
}
