import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/session'
import { PageHeader } from '@/components/admin/ui'
import { TeamManager } from '@/components/admin/TeamManager'

export const metadata: Metadata = { title: 'Команда' }

export default async function TeamPage() {
  const session = await requirePermission('team:manage')
  const users = await prisma.user.findMany({
    where: { propertyId: session.propertyId },
    orderBy: [{ createdAt: 'asc' }],
    select: { id: true, name: true, email: true, role: true },
  })

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Команда" sub="Кто может входить в панель этой усадьбы и что ему доступно. Пароль новому сотруднику вы передаёте сами: он показывается один раз." />
      <TeamManager users={users} currentUserId={session.userId} />
    </div>
  )
}
