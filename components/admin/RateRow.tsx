'use client'

import { useState, useTransition } from 'react'
import { updateRate } from '@/app/admin/actions'

type Props = { id: string; name: string; when: string; price: number; extraGuest: number; showExtraGuest: boolean }

export function RateRow({ id, name, when, price, extraGuest, showExtraGuest }: Props) {
  const [p, setP] = useState(price)
  const [x, setX] = useState(extraGuest)
  const [saved, setSaved] = useState(false)
  const [pending, run] = useTransition()
  const dirty = p !== price || x !== extraGuest

  return (
    <tr>
      <td className="px-5 py-2.5 font-medium">{name}</td>
      <td className="px-2 py-2.5 text-ink-2">{when}</td>
      <td className="px-2 py-2.5">
        <input className="field h-9 w-24 text-right tabular-nums" type="number" min={0} value={p} onChange={(e) => setP(Number(e.target.value))} aria-label={`${name}: цена`} />
      </td>
      <td className="px-2 py-2.5">
        {showExtraGuest && (
          <input className="field h-9 w-20 text-right tabular-nums" type="number" min={0} value={x} onChange={(e) => setX(Number(e.target.value))} aria-label={`${name}: доплата за гостя`} />
        )}
      </td>
      <td className="px-5 py-2.5 text-right">
        {dirty ? (
          <button
            className="btn-ink btn-sm"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const res = await updateRate(id, p, x)
                if (res.ok) {
                  setSaved(true)
                  setTimeout(() => setSaved(false), 1500)
                }
              })
            }
          >
            Сохранить
          </button>
        ) : (
          saved && <span className="text-xs text-ok">Сохранено</span>
        )}
      </td>
    </tr>
  )
}
