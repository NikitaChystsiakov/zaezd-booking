import './globals.css'
import type { Metadata } from 'next'
import { Cormorant_Garamond, Manrope } from 'next/font/google'

const manrope = Manrope({ subsets: ['latin', 'cyrillic'], variable: '--font-manrope', display: 'swap' })
const cormorant = Cormorant_Garamond({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-cormorant',
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'Бронирование усадьбы', template: '%s' },
  description: 'Календарь свободных дат, расчёт стоимости и заявка на бронь для загородных усадеб.',
  robots: { index: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${manrope.variable} ${cormorant.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  )
}
