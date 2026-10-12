'use client'

import { useState, useTransition } from 'react'
import { X } from 'lucide-react'
import { deleteUnit, saveUnit, type UnitInput } from '@/app/admin/actions'
import { Section, SaveBar } from './ui'

export function UnitForm({ unitId, initial, canDelete }: { unitId: string; initial: UnitInput; canDelete: boolean }) {
  const [u, setU] = useState(initial)
  const [tag, setTag] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, run] = useTransition()
  const set = <K extends keyof UnitInput>(k: K, v: UnitInput[K]) => setU((p) => ({ ...p, [k]: v }))

  function addTag() {
    const t = tag.trim()
    if (t && !u.amenities.includes(t)) set('amenities', [...u.amenities, t])
    setTag('')
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        run(async () => {
          const res = await saveUnit(unitId, u)
          setMsg(res.ok ? { ok: true, text: 'Сохранено' } : { ok: false, text: res.error })
        })
      }}
    >
      <Section
        title="Описание"
        sub="Название, короткая подпись и текст — как на странице бронирования."
        aside={
          <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
            <span>Показывать на сайте</span>
            <input type="checkbox" className="peer sr-only" checked={u.active} onChange={(e) => set('active', e.target.checked)} />
            <span className="relative h-6 w-11 rounded-full bg-line-strong transition-colors peer-checked:bg-ok peer-focus-visible:outline-2 peer-focus-visible:outline-brass after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
          </label>
        }
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_140px]">
          <div>
            <label className="label" htmlFor="uf-name">Название</label>
            <input id="uf-name" className="field" value={u.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="uf-sum">Подпись</label>
            <input id="uf-sum" className="field" value={u.summary} onChange={(e) => set('summary', e.target.value)} placeholder="Двухэтажный сруб из сосны" />
          </div>
          <div>
            <label className="label" htmlFor="uf-cap">Гостей максимум</label>
            <input id="uf-cap" className="field tabular-nums" type="number" min={1} value={u.capacity} onChange={(e) => set('capacity', Number(e.target.value))} />
          </div>
        </div>
        <div className="mt-4">
          <label className="label" htmlFor="uf-desc">Текст о доме</label>
          <textarea id="uf-desc" className="field h-auto min-h-32 py-3 leading-relaxed" value={u.description} onChange={(e) => set('description', e.target.value)} />
        </div>
        <div className="mt-4">
          <span className="label">Что есть в доме</span>
          <div className="flex flex-wrap gap-2">
            {u.amenities.map((a) => (
              <span key={a} className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-1 pr-1.5 pl-3 text-[13px] font-medium">
                {a}
                <button type="button" aria-label={`Убрать: ${a}`} className="grid size-5 place-items-center rounded-full text-ink-3 hover:bg-line hover:text-ink" onClick={() => set('amenities', u.amenities.filter((x) => x !== a))}>
                  <X size={12} />
                </button>
              </span>
            ))}
            <input
              className="h-8 min-w-48 rounded-full border border-dashed border-line-strong bg-transparent px-3 text-[13px] focus:border-ink focus:outline-none"
              placeholder="+ добавить и Enter"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTag()
                }
              }}
              onBlur={addTag}
              aria-label="Новое удобство"
            />
          </div>
        </div>

        <div className="mt-6 grid gap-4 border-t border-line pt-6 sm:grid-cols-2">
          <div>
            <span className="label">Скидка за долгое проживание</span>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>с</span>
              <input className="field h-10 w-20 tabular-nums" type="number" min={2} value={u.longStayFromNight ?? ''} placeholder="—" onChange={(e) => set('longStayFromNight', e.target.value ? Number(e.target.value) : null)} aria-label="С какой ночи" />
              <span>ночи —</span>
              <input className="field h-10 w-20 tabular-nums" type="number" min={0} max={90} value={u.longStayPercent} onChange={(e) => set('longStayPercent', Number(e.target.value))} aria-label="Процент скидки" />
              <span>%</span>
            </div>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <SaveBar pending={pending} msg={msg} />
          {canDelete && (
            <button
              type="button"
              className="btn-quiet btn-sm text-alert"
              disabled={pending}
              onClick={() => {
                if (!confirm(`Удалить «${u.name}» вместе с тарифами? Это нельзя отменить.`)) return
                run(async () => {
                  const res = await deleteUnit(unitId)
                  if (res && !res.ok) setMsg({ ok: false, text: res.error })
                })
              }}
            >
              Удалить дом
            </button>
          )}
        </div>
      </Section>
    </form>
  )
}
