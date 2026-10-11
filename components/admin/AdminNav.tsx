'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BedDouble, CalendarDays, Inbox, Settings, Sparkles, SquarePen } from 'lucide-react'

const ITEMS = [
  { href: '/admin', label: 'Заявки', icon: Inbox, match: (p: string) => p === '/admin' || p.startsWith('/admin/leads') },
  { href: '/admin/calendar', label: 'Календарь', icon: CalendarDays },
  { href: '/admin/units', label: 'Дома и тарифы', icon: BedDouble },
  { href: '/admin/extras', label: 'Услуги', icon: Sparkles },
  { href: '/admin/property', label: 'Тексты и фото', icon: SquarePen },
  { href: '/admin/settings', label: 'Настройки', icon: Settings },
]

export function AdminNav({ newCount }: { newCount: number }) {
  const pathname = usePathname()
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-4 lg:pb-0">
      {ITEMS.map(({ href, label, icon: Icon, match }) => {
        const active = match ? match(pathname) : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-3 rounded-full px-4 py-2.5 text-sm transition-colors ${active ? 'bg-side-ink font-semibold text-side' : 'text-side-ink-2 hover:bg-white/5 hover:text-side-ink'}`}
          >
            <Icon size={17} strokeWidth={1.8} />
            {label}
            {href === '/admin' && newCount > 0 && (
              <span className={`ml-auto grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold ${active ? 'bg-brass text-white' : 'bg-brass text-side'}`}>{newCount}</span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
