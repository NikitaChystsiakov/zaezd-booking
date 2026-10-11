'use client'

import { useState, useTransition } from 'react'
import type { LeadStatus } from '@prisma/client'
import { setLeadStatus } from '@/app/admin/actions'

const NEXT: Record<LeadStatus, { status: LeadStatus; label: string; primary?: boolean }[]> = {
  new: [
    { status: 'contacted', label: 'Связались, ждём задаток', primary: true },
    { status: 'booked', label: 'Задаток получен — подтвердить' },
    { status: 'lost', label: 'Отказ' },
  ],
  contacted: [
    { status: 'booked', label: 'Задаток получен — подтвердить', primary: true },
    { status: 'lost', label: 'Отказ' },
  ],
  proposal: [
    { status: 'booked', label: 'Задаток получен — подтвердить', primary: true },
    { status: 'lost', label: 'Отказ' },
  ],
  booked: [
    { status: 'done', label: 'Заезд состоялся', primary: true },
    { status: 'contacted', label: 'Снять подтверждение' },
    { status: 'lost', label: 'Гость отменил' },
  ],
  done: [{ status: 'booked', label: 'Вернуть в подтверждённые' }],
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
            className={`w-full ${n.primary ? 'btn-primary' : n.status === 'lost' ? 'btn-quiet' : 'btn-ghost'}`}
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
        <p className="mt-3 text-xs leading-relaxed text-ink-3">Пока даты пересекаются с занятыми, подтвердить не получится — одни даты не продаются дважды.</p>
      )}
      {error && (
        <p className="mt-3 text-sm text-alert" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
