import type { Metadata } from 'next'
import { ArrowUpRight, LogOut } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'
import { logout } from '@/app/login/actions'
import { AdminNav } from '@/components/admin/AdminNav'

export const metadata: Metadata = { title: { default: 'Панель управления', template: '%s · Панель управления' } }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  const [property, user, newCount] = await Promise.all([
    prisma.property.findUniqueOrThrow({ where: { id: session.propertyId }, select: { name: true, kind: true, slug: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: session.userId }, select: { name: true, email: true } }),
    prisma.lead.count({ where: { propertyId: session.propertyId, status: 'new' } }),
  ])

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="bg-side text-side-ink lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="flex items-center justify-between gap-4 px-5 pt-5 pb-4 lg:block lg:px-6 lg:pt-8 lg:pb-8">
          <div>
            {property.kind && <div className="eyebrow text-side-ink-2">{property.kind}</div>}
            <div className="display text-[30px] leading-none">{property.name}</div>
          </div>
          <a href={`/u/${property.slug}`} target="_blank" className="inline-flex items-center gap-1 text-[13px] text-side-ink-2 hover:text-side-ink lg:mt-3">
            Сайт бронирования <ArrowUpRight size={13} />
          </a>
        </div>
        <AdminNav newCount={newCount} />
        <div className="hidden border-t border-side-line px-6 py-5 lg:mt-auto lg:block">
          <div className="text-sm font-semibold">{user.name}</div>
          <div className="truncate text-xs text-side-ink-2">{user.email}</div>
          <form action={logout} className="mt-3">
            <button className="inline-flex items-center gap-1.5 text-[13px] text-side-ink-2 hover:text-side-ink">
              <LogOut size={14} /> Выйти
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-7 sm:px-8 lg:px-12 lg:py-10">{children}</main>
    </div>
  )
}
