'use client'

import { useState, useTransition } from 'react'
import type { LeadStatus } from '@prisma/client'
import { setLeadStatus } from '@/app/admin/actions'

const NEXT: Record<LeadStatus, { status: LeadStatus; label: string; primary?: boolean }[]> = {
  new: [
    { status: 'contacted', label: 'Созвонились', primary: true },
    { status: 'lost', label: 'Отказ' },
  ],
  contacted: [
    { status: 'booked', label: 'Предоплата получена', primary: true },
    { status: 'lost', label: 'Отказ' },
  ],
  proposal: [
    { status: 'booked', label: 'Предоплата получена', primary: true },
    { status: 'contacted', label: 'Вернуть в «Созвонились»' },
    { status: 'lost', label: 'Отказ' },
  ],
  booked: [
    { status: 'done', label: 'Заезд состоялся', primary: true },
    { status: 'proposal', label: 'Снять бронь' },
  ],
  done: [{ status: 'booked', label: 'Вернуть в «Бронь»' }],
  lost: [{ status: 'new', label: 'Вернуть в работу', primary: true }],
}

export function LeadStatusActions({ leadId, status, hasConflicts }: { leadId: string; status: LeadStatus; hasConflicts: boolean }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  return (
    <div>
      <div className="flex flex-col gap-2">
        {NEXT[status].map((n) => (
          <button
            key={n.status}
            disabled={pending}
            className={n.primary ? 'btn-primary' : 'btn-ghost'}
            onClick={() =>
              start(async () => {
                setError(null)
                const res = await setLeadStatus(leadId, n.status)
                if (!res.ok) setError(res.error)
              })
            }
          >
            {n.label}
          </button>
        ))}
      </div>
      {hasConflicts && NEXT[status].some((n) => n.status === 'booked') && !error && (
        <p className="mt-3 text-xs text-ink-3">Бронь не пройдёт, пока даты пересекаются с занятыми — система не даст продать их дважды.</p>
      )}
      {error && <p className="mt-3 text-sm text-accent" role="alert">{error}</p>}
    </div>
  )
}
