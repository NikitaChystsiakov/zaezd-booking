import type { Metadata } from 'next'
import AboutUs from '@/components/forms/map/YandexMap'

export const metadata: Metadata = {
  title: 'О нас — WebSofa',
  description: 'Контакты, графики работы и карта магазинов.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/about' },
  openGraph: { url: '/about' },
}

export default function AboutPage() {
  return (
    <section>
      <AboutUs />
    </section>
  )
}
