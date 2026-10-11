'use client'

import { useTransition } from 'react'
import { setLeadUnit } from '@/app/admin/actions'

export function UnitPicker({ leadId, value, units }: { leadId: string; value: string | null; units: { id: string; name: string; capacity: number }[] }) {
  const [pending, start] = useTransition()
  return (
    <select
      className={`field h-9 font-medium ${value ? '' : 'border-warn text-warn'}`}
      value={value ?? ''}
      disabled={pending}
      onChange={(e) => e.target.value && start(async () => void (await setLeadUnit(leadId, e.target.value)))}
    >
      {!value && <option value="">Выбрать объект…</option>}
      {units.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name} (до {u.capacity})
        </option>
      ))}
    </select>
  )
}
