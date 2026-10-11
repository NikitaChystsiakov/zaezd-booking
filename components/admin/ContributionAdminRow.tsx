'use client'

import { useTransition } from 'react'
import { Check } from 'lucide-react'
import type { ContributionStatus } from '@prisma/client'
import { confirmContribution } from '@/app/admin/actions'
import { formatMoney } from '@/lib/quote'

const LABEL: Record<ContributionStatus, string> = {
  pledged: 'обещал(а) перевести',
  marked_paid: 'отметил(а): перевёл',
  confirmed: 'деньги получены',
}

export function ContributionAdminRow({ id, name, amount, status }: { id: string; name: string; amount: number; status: ContributionStatus }) {
  const [pending, start] = useTransition()
  return (
    <li className="flex items-center gap-3 px-3 py-2.5 text-sm">
      <div className="min-w-0 flex-1">
        <span className="font-medium">{name}</span>
        <span className={`ml-2 text-xs ${status === 'confirmed' ? 'text-ok' : status === 'marked_paid' ? 'text-warn' : 'text-ink-3'}`}>{LABEL[status]}</span>
      </div>
      <span className="tabular-nums">{formatMoney(amount)}</span>
      {status === 'confirmed' ? (
        <button className="btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => void (await confirmContribution(id, false)))}>
          Отменить
        </button>
      ) : (
        <button className="btn-ink btn-sm" disabled={pending} onClick={() => start(async () => void (await confirmContribution(id, true)))}>
          <Check size={14} /> Получено
        </button>
      )}
    </li>
  )
}
