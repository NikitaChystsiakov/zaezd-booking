'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { createUnit } from '@/app/admin/actions'

export function NewUnitForm() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [capacity, setCapacity] = useState(6)
  const [error, setError] = useState<string | null>(null)
  const [pending, run] = useTransition()

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-[18px] border-2 border-dashed border-line-strong text-ink-2 transition-colors hover:border-ink hover:text-ink">
        <span className="grid size-12 place-items-center rounded-full bg-surface-2">
          <Plus size={22} />
        </span>
        <span className="font-semibold">Добавить дом или номер</span>
      </button>
    )
  }

  return (
    <form
      className="card flex min-h-64 flex-col justify-center gap-4 p-6"
      onSubmit={(e) => {
        e.preventDefault()
        run(async () => {
          const res = await createUnit(name, capacity)
          if (res && !res.ok) setError(res.error)
        })
      }}
    >
      <h2 className="text-[17px] font-bold">Новый дом</h2>
      <div className="grid grid-cols-[1fr_120px] gap-3">
        <div>
          <label className="label" htmlFor="nu-name">Название</label>
          <input id="nu-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Например: Дом у пруда" autoFocus required />
        </div>
        <div>
          <label className="label" htmlFor="nu-cap">Гостей</label>
          <input id="nu-cap" className="field tabular-nums" type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
        </div>
      </div>
      <p className="text-[13px] text-ink-3">Дом появится скрытым — добавьте фото и цены, потом покажите его на сайте.</p>
      {error && <p className="text-sm text-alert">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>Создать</button>
        <button type="button" className="btn-quiet" onClick={() => setOpen(false)}>Отмена</button>
      </div>
    </form>
  )
}
