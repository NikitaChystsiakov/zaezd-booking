import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Golos_Text, Lora } from 'next/font/google'

const golos = Golos_Text({ subsets: ['latin', 'cyrillic'], variable: '--font-golos', display: 'swap' })
const lora = Lora({ subsets: ['latin', 'cyrillic'], variable: '--font-lora', style: ['normal', 'italic'], display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'Гуртом — заявки для загородных площадок', template: '%s · Гуртом' },
  description:
    'Система заявок для усадеб и загородных комплексов: заявка с расчётом, карточка звонка для администратора, живое КП и «скинуться компанией».',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f3ee' },
    { media: '(prefers-color-scheme: dark)', color: '#171715' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${golos.variable} ${lora.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  )
}
