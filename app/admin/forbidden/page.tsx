import Link from 'next/link'
import type { Metadata } from 'next'
import { requireSession } from '@/lib/session'
import { ROLE_LABEL } from '@/lib/permissions'
import { PageHeader } from '@/components/admin/ui'

export const metadata: Metadata = { title: 'Нет доступа' }

export default async function ForbiddenPage() {
  const session = await requireSession()
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Нет доступа" sub={`Эти действия недоступны вашей роли — «${ROLE_LABEL[session.role]}». Если они нужны, попросите владельца усадьбы изменить роль.`} />
      <Link href="/admin" className="btn-primary">
        К заявкам
      </Link>
    </div>
  )
}
