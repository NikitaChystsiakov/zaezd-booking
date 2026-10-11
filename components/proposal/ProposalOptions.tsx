'use client'

import { useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import { chooseOption } from '@/app/o/[token]/actions'
import { formatMoney } from '@/lib/quote'
import type { ProposalOption } from '@/lib/domain'

type Props = {
  token: string
  options: ProposalOption[]
  chosenOptionId: string | null
  accepted: boolean
  booked: boolean
  extras: Record<string, { name: string; description: string | null }>
}

export function ProposalOptions({ token, options, chosenOptionId, accepted, booked, extras }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  return (
    <div>
      <div className={`grid gap-3 ${options.length >= 3 ? 'sm:grid-cols-3' : options.length === 2 ? 'sm:grid-cols-2' : ''}`}>
        {options.map((o) => {
          const isChosen = o.id === chosenOptionId
          return (
            <div key={o.id} className={`card relative flex flex-col p-5 ${isChosen ? 'border-2 border-accent' : ''}`}>
              {isChosen && (
                <span className="chip absolute -top-3 left-4 bg-accent text-accent-ink">{accepted ? 'Ваш выбор' : 'Рекомендуем'}</span>
              )}
              <div className="font-semibold">{o.title}</div>
              <div className="mt-2 text-2xl font-semibold tabular-nums">{formatMoney(o.price)}</div>
              {o.note && <p className="mt-2 text-sm text-ink-2">{o.note}</p>}
              <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                {o.extraIds.length === 0 && <li className="text-ink-3">Только проживание</li>}
                {o.extraIds.map((id) =>
                  extras[id] ? (
                    <li key={id} className="flex gap-2">
                      <Check size={15} className="mt-0.5 shrink-0 text-ok" /> {extras[id].name}
                    </li>
                  ) : null,
                )}
              </ul>
              {!booked && (
                <button
                  className={`mt-5 w-full ${isChosen && accepted ? 'btn-ghost' : 'btn-primary'}`}
                  disabled={pending || (isChosen && accepted)}
                  onClick={() =>
                    start(async () => {
                      setError(null)
                      const res = await chooseOption(token, o.id)
                      if (!res.ok) setError(res.error)
                    })
                  }
                >
                  {isChosen && accepted ? 'Выбрано' : 'Выбираю этот'}
                </button>
              )}
            </div>
          )
        })}
      </div>
      {accepted && !booked && <p className="mt-4 text-sm text-ink-2">Администратор видит ваш выбор. Осталось внести предоплату — ниже.</p>}
      {error && <p className="mt-3 text-sm text-accent" role="alert">{error}</p>}
    </div>
  )
}
