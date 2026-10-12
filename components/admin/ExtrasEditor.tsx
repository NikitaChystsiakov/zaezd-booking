'use client'

import { useState, useTransition } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { deleteExtra, saveExtra, type ExtraInput } from '@/app/admin/actions'
import { PRICE_TYPE_LABEL } from '@/lib/domain'

type Row = ExtraInput & { id: string }

const TYPES: { v: ExtraInput['priceType']; label: string; note: string }[] = [
  { v: 'per_item', label: 'Гость выбирает количество', note: 'сеансы бани, часы, порции, люди на прогулке' },
  { v: 'per_stay', label: 'Один раз за заезд', note: 'подготовка мангала, питомец' },
  { v: 'per_night', label: 'За каждую ночь', note: 'например, завтрак в номер' },
  { v: 'per_person', label: 'За каждого гостя', note: 'считается по числу гостей в брони' },
]

export function ExtrasEditor({ extras, canDelete }: { extras: Row[]; canDelete: boolean }) {
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const groups = [...new Set(extras.map((e) => e.group || 'Без группы'))]
  const blank: ExtraInput = { name: '', description: '', group: groups[0] === 'Без группы' ? '' : (groups[0] ?? ''), priceType: 'per_item', price: 0, unitLabel: 'шт.', maxQty: 10, active: true }

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        {editing !== 'new' && (
          <button className="btn-primary" onClick={() => setEditing('new')}>
            <Plus size={16} /> Новая услуга
          </button>
        )}
      </div>
      {editing === 'new' && (
        <div className="card p-6">
          <ExtraForm extraId={null} initial={blank} groups={groups} canDelete={canDelete} onDone={() => setEditing(null)} />
        </div>
      )}
      {groups.map((g) => (
        <section key={g}>
          <h2 className="eyebrow mb-3 text-ink-3">{g}</h2>
          <ul className="card divide-y divide-line overflow-hidden">
            {extras
              .filter((e) => (e.group || 'Без группы') === g)
              .map((e) =>
                editing === e.id ? (
                  <li key={e.id} className="bg-surface-2/50 p-6">
                    <ExtraForm extraId={e.id} initial={e} groups={groups} canDelete={canDelete} onDone={() => setEditing(null)} />
                  </li>
                ) : (
                  <li key={e.id} className={`flex items-center gap-4 px-5 py-4 ${e.active ? '' : 'opacity-55'}`}>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">
                        {e.name} {!e.active && <span className="chip ml-1 bg-muted-soft text-ink-2">скрыта</span>}
                      </div>
                      {e.description && <div className="text-sm text-ink-3">{e.description}</div>}
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <div className="font-semibold tabular-nums">{e.price} BYN</div>
                      <div className="text-xs text-ink-3">{e.priceType === 'per_item' ? `за ${e.unitLabel || 'шт.'}, до ${e.maxQty}` : PRICE_TYPE_LABEL[e.priceType]}</div>
                    </div>
                    <button className="grid size-9 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label={`Изменить «${e.name}»`} onClick={() => setEditing(e.id)}>
                      <Pencil size={15} />
                    </button>
                  </li>
                ),
              )}
          </ul>
        </section>
      ))}
    </div>
  )
}

function ExtraForm({ extraId, initial, groups, canDelete, onDone }: { extraId: string | null; initial: ExtraInput; groups: string[]; canDelete: boolean; onDone: () => void }) {
  const [e, setE] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, run] = useTransition()
  const set = <K extends keyof ExtraInput>(k: K, v: ExtraInput[K]) => setE((p) => ({ ...p, [k]: v }))

  return (
    <form
      className="space-y-4"
      onSubmit={(ev) => {
        ev.preventDefault()
        run(async () => {
          setError(null)
          const res = await saveExtra(extraId, e)
          if (res.ok) onDone()
          else setError(res.error)
        })
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <div>
          <label className="label" htmlFor="ef-name">Название</label>
          <input id="ef-name" className="field" value={e.name} onChange={(x) => set('name', x.target.value)} autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="ef-group">Группа</label>
          <input id="ef-group" className="field" list="ef-groups" value={e.group} onChange={(x) => set('group', x.target.value)} placeholder="Баня, Лошади…" />
          <datalist id="ef-groups">
            {groups.filter((g) => g !== 'Без группы').map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="ef-desc">Пояснение для гостя</label>
        <input id="ef-desc" className="field" value={e.description} onChange={(x) => set('description', x.target.value)} />
      </div>
      <div>
        <span className="label">Как считается</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {TYPES.map((t) => (
            <label key={t.v} className={`cursor-pointer rounded-xl border p-3 ${e.priceType === t.v ? 'border-accent bg-accent-soft/50' : 'border-line'}`}>
              <input type="radio" className="sr-only" name="ef-type" checked={e.priceType === t.v} onChange={() => set('priceType', t.v)} />
              <span className="block text-sm font-semibold">{t.label}</span>
              <span className="block text-xs text-ink-3">{t.note}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="ef-price">Цена, BYN</label>
          <input id="ef-price" className="field tabular-nums" type="number" min={0} value={e.price} onChange={(x) => set('price', Number(x.target.value))} />
        </div>
        {e.priceType === 'per_item' && (
          <>
            <div>
              <label className="label" htmlFor="ef-unit">Единица</label>
              <input id="ef-unit" className="field" value={e.unitLabel} onChange={(x) => set('unitLabel', x.target.value)} placeholder="сеанс, час, чел." />
            </div>
            <div>
              <label className="label" htmlFor="ef-max">Не больше</label>
              <input id="ef-max" className="field tabular-nums" type="number" min={1} value={e.maxQty} onChange={(x) => set('maxQty', Number(x.target.value))} />
            </div>
          </>
        )}
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
        <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={e.active} onChange={(x) => set('active', x.target.checked)} />
        Показывать гостям
      </label>
      {error && <p className="text-sm text-alert">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={pending}>{pending ? 'Сохраняем…' : 'Сохранить'}</button>
        <button type="button" className="btn-quiet" onClick={onDone}>Отмена</button>
        {extraId && canDelete && (
          <button
            type="button"
            className="btn-quiet ml-auto text-alert"
            onClick={() => confirm(`Удалить «${initial.name}»?`) && run(async () => void (await deleteExtra(extraId), onDone()))}
          >
            <Trash2 size={15} /> Удалить
          </button>
        )}
      </div>
    </form>
  )
}
