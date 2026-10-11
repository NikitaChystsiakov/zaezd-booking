import Link from 'next/link'
import { ExternalLink, LogOut } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'
import { logout } from '@/app/login/actions'
import { Logo } from '@/components/Logo'
import { AdminNav } from '@/components/admin/AdminNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  const [property, user, newCount] = await Promise.all([
    prisma.property.findUniqueOrThrow({ where: { id: session.propertyId }, select: { name: true, slug: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: session.userId }, select: { name: true } }),
    prisma.lead.count({ where: { propertyId: session.propertyId, status: 'new' } }),
  ])

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="border-b border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 py-4 lg:block lg:px-5 lg:py-6">
          <Link href="/admin">
            <Logo />
          </Link>
          <div className="hidden lg:mt-6 lg:block">
            <div className="eyebrow">Площадка</div>
            <div className="mt-1 font-medium">{property.name}</div>
          </div>
        </div>
        <AdminNav newCount={newCount} />
        <div className="hidden space-y-1 border-t border-line px-3 py-4 text-sm lg:mt-auto lg:block">
          <a href={`/u/${property.slug}`} target="_blank" className="flex items-center gap-2 rounded-lg px-3 py-2 text-ink-2 hover:bg-surface-2 hover:text-ink">
            <ExternalLink size={15} /> Сайт площадки
          </a>
          <form action={logout}>
            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-ink-2 hover:bg-surface-2 hover:text-ink">
              <LogOut size={15} /> Выйти ({user.name})
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  )
}
