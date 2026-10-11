'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Inbox, Settings, Tags } from 'lucide-react'

const ITEMS = [
  { href: '/admin', label: 'Заявки', icon: Inbox, exact: true },
  { href: '/admin/calendar', label: 'Календарь', icon: CalendarDays },
  { href: '/admin/prices', label: 'Цены и услуги', icon: Tags },
  { href: '/admin/settings', label: 'Настройки', icon: Settings },
]

export function AdminNav({ newCount }: { newCount: number }) {
  const pathname = usePathname()
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:pb-0">
      {ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href || pathname.startsWith('/admin/leads') : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${active ? 'bg-surface-2 font-medium text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'}`}
          >
            <Icon size={16} />
            {label}
            {href === '/admin' && newCount > 0 && (
              <span className="ml-auto rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-5 text-accent-ink">{newCount}</span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
