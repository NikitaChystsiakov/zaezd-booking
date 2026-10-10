// app/layout.tsx
import './globals.css'
import type { Metadata } from 'next'
import type { PropsWithChildren } from 'react'
import { cookies } from 'next/headers'
import Script from 'next/script'

import { CartProvider } from '@/components/cart/CartProvider'
import { ToastProvider } from '@/hooks/useToast'

export const metadata: Metadata = {
  title: 'WebSofa',
  description: 'Каталог мебели',
}

const themeInit = `
(function() {
  try {
    var m = document.cookie.match(/(?:^|;\\s*)theme=(light|dark)/);
    var cookieTheme = m && m[1];

    var ls = localStorage.getItem('theme');
    var t = (ls === 'light' || ls === 'dark') ? ls : cookieTheme;

    if (!t) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      t = mq.matches ? 'dark' : 'light';
    }

    document.documentElement.dataset.theme = t;
    document.documentElement.style.colorScheme = t;
  } catch (e) {}
})();
`

export default async function RootLayout({ children }: PropsWithChildren) {
  const cookieStore = await cookies()
  const cookieTheme = cookieStore.get('theme')?.value
  const theme = cookieTheme === 'dark' ? 'dark' : 'light'

  return (
    <html lang="ru" data-theme={theme} suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInit}
        </Script>
      </head>

      <body>
        <CartProvider>
          <ToastProvider>{children}</ToastProvider>
        </CartProvider>
      </body>
    </html>
  )
}
