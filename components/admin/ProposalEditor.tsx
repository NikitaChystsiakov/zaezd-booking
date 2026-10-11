'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { saveProposal } from '@/app/admin/actions'
import type { ProposalOption } from '@/lib/domain'

type Props = {
  leadId: string
  hasProposal: boolean
  extras: { id: string; name: string }[]
  initial: {
    options: ProposalOption[]
    chosenOptionId: string
    message: string
    prepaymentPercent: number
    prepaymentAmount: number | null
    splitEnabled: boolean
  }
}

const round10 = (n: number) => Math.round(n / 10) * 10

export function ProposalEditor({ leadId, hasProposal, extras, initial }: Props) {
  const [open, setOpen] = useState(!hasProposal)
  const [options, setOptions] = useState<ProposalOption[]>(initial.options)
  const [chosen, setChosen] = useState(initial.chosenOptionId)
  const [message, setMessage] = useState(initial.message)
  const [prepayManual, setPrepayManual] = useState<number | null>(initial.prepaymentAmount)
  const [split, setSplit] = useState(initial.splitEnabled)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const chosenPrice = options.find((o) => o.id === chosen)?.price ?? options[0]?.price ?? 0
  const prepay = prepayManual ?? round10((chosenPrice * initial.prepaymentPercent) / 100)

  const patch = (id: string, p: Partial<ProposalOption>) => setOptions((list) => list.map((o) => (o.id === id ? { ...o, ...p } : o)))

  if (!open) {
    return (
      <button className="btn-ghost w-full" onClick={() => setOpen(true)}>
        Изменить КП
      </button>
    )
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-2">
        Варианты уже посчитаны по ценам площадки. Поправьте названия и цену после разговора — гость увидит их на своей странице.
      </p>

      <div className="space-y-3">
        {options.map((o) => (
          <div key={o.id} className={`rounded-lg border p-4 ${chosen === o.id ? 'border-ink' : 'border-line'}`}>
            <div className="flex flex-wrap items-center gap-2">
              <input className="field h-9 min-w-40 flex-1 font-medium" value={o.title} onChange={(e) => patch(o.id, { title: e.target.value })} aria-label="Название варианта" />
              <div className="flex items-center gap-1">
                <input
                  className="field h-9 w-28 text-right tabular-nums"
                  type="number"
                  min={0}
                  value={o.price}
                  onChange={(e) => patch(o.id, { price: Number(e.target.value) })}
                  aria-label="Цена варианта"
                />
                <span className="text-sm text-ink-3">BYN</span>
              </div>
              <button
                type="button"
                className="grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-accent disabled:opacity-30"
                disabled={options.length <= 1}
                aria-label="Удалить вариант"
                onClick={() => {
                  setOptions(options.filter((x) => x.id !== o.id))
                  if (chosen === o.id) setChosen(options.find((x) => x.id !== o.id)!.id)
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
            <input className="field mt-2 h-9" placeholder="Пояснение: что входит, кому подходит" value={o.note ?? ''} onChange={(e) => patch(o.id, { note: e.target.value })} />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {extras.map((e) => {
                const on = o.extraIds.includes(e.id)
                return (
                  <button
                    type="button"
                    key={e.id}
                    onClick={() => patch(o.id, { extraIds: on ? o.extraIds.filter((x) => x !== e.id) : [...o.extraIds, e.id] })}
                    className={`chip border ${on ? 'border-ink bg-ink text-paper' : 'border-line-strong text-ink-2 hover:border-ink'}`}
                  >
                    {e.name}
                  </button>
                )
              })}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-ink-2">
              <input type="radio" name="chosen" checked={chosen === o.id} onChange={() => setChosen(o.id)} className="accent-[var(--accent)]" />
              Рекомендуем этот вариант
            </label>
          </div>
        ))}
        {options.length < 4 && (
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => setOptions([...options, { id: `o${Date.now()}`, title: 'Свой вариант', note: '', price: chosenPrice, extraIds: [] }])}
          >
            <Plus size={14} /> Вариант
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="pe-prepay">Предоплата для брони</label>
          <div className="flex items-center gap-2">
            <input
              id="pe-prepay"
              className="field tabular-nums"
              type="number"
              min={0}
              value={prepay}
              onChange={(e) => setPrepayManual(Number(e.target.value))}
            />
            <span className="text-sm text-ink-3">BYN</span>
          </div>
          {prepayManual === null && <p className="mt-1 text-xs text-ink-3">{initial.prepaymentPercent}% от рекомендованного варианта</p>}
        </div>
        <label className="flex items-start gap-3 rounded-lg border border-line p-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={split} onChange={(e) => setSplit(e.target.checked)} />
          <span>
            <span className="font-medium">Скинуться компанией</span>
            <span className="block text-xs text-ink-3">Каждый гость отмечает свою долю, вы подтверждаете получение</span>
          </span>
        </label>
      </div>

      <div>
        <label className="label" htmlFor="pe-msg">Сообщение гостю</label>
        <textarea id="pe-msg" className="field h-auto min-h-24 py-2" value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>

      {error && <p className="text-sm text-accent" role="alert">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          className="btn-primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null)
              const res = await saveProposal(leadId, { options, chosenOptionId: chosen, message, prepaymentAmount: prepay, splitEnabled: split })
              if (res.ok) setOpen(false)
              else setError(res.error)
            })
          }
        >
          {pending ? 'Сохраняем…' : hasProposal ? 'Сохранить изменения' : 'Создать КП и получить ссылку'}
        </button>
        {hasProposal && (
          <button className="btn-ghost" onClick={() => setOpen(false)}>
            Отмена
          </button>
        )}
      </div>
    </div>
  )
}
