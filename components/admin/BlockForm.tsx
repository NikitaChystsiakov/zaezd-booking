'use client'

import { useState, useTransition } from 'react'
import { addBlock } from '@/app/admin/actions'
import { addDays } from '@/lib/dates'

export function BlockForm({ units, today }: { units: { id: string; name: string }[]; today: string }) {
  const [unitId, setUnitId] = useState(units[0]?.id ?? '')
  const [start, setStart] = useState(today)
  const [end, setEnd] = useState(addDays(today, 1))
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, run] = useTransition()

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault()
        run(async () => {
          setError(null)
          const res = await addBlock(unitId, start, end, reason)
          if (res.ok) setReason('')
          else setError(res.error)
        })
      }}
    >
      <div className="sm:col-span-2">
        <label className="label" htmlFor="bf-unit">Объект</label>
        <select id="bf-unit" className="field" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
          {units.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="bf-start">С</label>
        <input id="bf-start" type="date" className="field" value={start} min={today} onChange={(e) => setStart(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="bf-end">По (день выезда)</label>
        <input id="bf-end" type="date" className="field" value={end} min={addDays(start, 1)} onChange={(e) => setEnd(e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="bf-reason">Причина</label>
        <input id="bf-reason" className="field" placeholder="Например: бронь по телефону, ремонт" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {error && <p className="text-sm text-accent sm:col-span-2">{error}</p>}
      <button className="btn-ink sm:col-span-2" disabled={pending}>Закрыть даты</button>
    </form>
  )
}
