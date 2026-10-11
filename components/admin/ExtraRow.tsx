'use client'

import { useState, useTransition } from 'react'
import { updateExtra } from '@/app/admin/actions'

type Props = { id: string; name: string; description: string | null; unit: string; price: number; active: boolean }

export function ExtraRow({ id, name, description, unit, price, active }: Props) {
  const [p, setP] = useState(price)
  const [pending, run] = useTransition()

  return (
    <tr className={active ? '' : 'opacity-50'}>
      <td className="px-5 py-3">
        <div className="font-medium">{name}</div>
        {description && <div className="text-xs text-ink-3">{description}</div>}
      </td>
      <td className="px-2 py-3">
        <div className="flex items-center gap-2">
          <input className="field h-9 w-24 text-right tabular-nums" type="number" min={0} value={p} onChange={(e) => setP(Number(e.target.value))} aria-label={`${name}: цена`} />
          <span className="whitespace-nowrap text-xs text-ink-3">BYN {unit}</span>
        </div>
      </td>
      <td className="px-5 py-3 text-right">
        <div className="flex justify-end gap-2">
          {p !== price && (
            <button className="btn-ink btn-sm" disabled={pending} onClick={() => run(async () => void (await updateExtra(id, p, active)))}>
              Сохранить
            </button>
          )}
          <button className="btn-ghost btn-sm" disabled={pending} onClick={() => run(async () => void (await updateExtra(id, p, !active)))}>
            {active ? 'Скрыть' : 'Показать'}
          </button>
        </div>
      </td>
    </tr>
  )
}
