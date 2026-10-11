'use client'

import { useRef, useState, useTransition } from 'react'
import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from 'lucide-react'
import { updateUnitPhotos, uploadUnitPhotos } from '@/app/admin/actions'
import { Section } from './ui'

export function PhotoManager({ unitId, photos }: { unitId: string; photos: string[] }) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, run] = useTransition()

  function reorder(next: string[]) {
    run(async () => {
      const res = await updateUnitPhotos(unitId, next)
      if (!res.ok) setError(res.error)
    })
  }
  const move = (i: number, d: number) => {
    const next = [...photos]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    reorder(next)
  }

  return (
    <Section
      title="Фото"
      sub="Первое фото — обложка: оно в карточке дома и в сводке брони. Подойдут JPG, PNG, WebP до 10 МБ."
      aside={
        <>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            aria-label="Загрузить фото"
            onChange={(e) => {
              const files = e.target.files
              if (!files?.length) return
              const form = new FormData()
              for (const f of files) form.append('photos', f)
              setError(null)
              run(async () => {
                const res = await uploadUnitPhotos(unitId, form)
                if (!res.ok) setError(res.error)
                if (input.current) input.current.value = ''
              })
            }}
          />
          <button type="button" className="btn-ghost btn-sm" disabled={pending} onClick={() => input.current?.click()}>
            <ImagePlus size={15} /> {pending ? 'Загружаем…' : 'Добавить фото'}
          </button>
        </>
      }
    >
      {error && <p className="mb-4 text-sm text-alert">{error}</p>}
      {photos.length ? (
        <ul className={`grid grid-cols-2 gap-3 sm:grid-cols-4 ${pending ? 'opacity-60' : ''}`}>
          {photos.map((p, i) => (
            <li key={p} className={`group relative overflow-hidden rounded-2xl bg-surface-2 ${i === 0 ? 'col-span-2 row-span-2' : ''}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt={`Фото ${i + 1}`} className={`photo-grade w-full object-cover ${i === 0 ? 'aspect-square sm:aspect-auto sm:h-full' : 'aspect-square'}`} />
              {i === 0 && <span className="chip absolute top-3 left-3 bg-surface/90 text-ink">Обложка</span>}
              <div className="absolute inset-x-2 bottom-2 flex justify-between gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                <div className="flex gap-1">
                  <IconBtn label="Левее" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowLeft size={14} />
                  </IconBtn>
                  <IconBtn label="Правее" disabled={i === photos.length - 1} onClick={() => move(i, 1)}>
                    <ArrowRight size={14} />
                  </IconBtn>
                  {i > 0 && (
                    <IconBtn label="Сделать обложкой" onClick={() => reorder([p, ...photos.filter((x) => x !== p)])}>
                      <Star size={14} />
                    </IconBtn>
                  )}
                </div>
                <IconBtn label="Удалить фото" onClick={() => confirm('Удалить фото?') && reorder(photos.filter((x) => x !== p))}>
                  <Trash2 size={14} />
                </IconBtn>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <button type="button" onClick={() => input.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line-strong py-12 text-ink-2 hover:border-ink hover:text-ink">
          <ImagePlus size={24} />
          <span className="font-semibold">Загрузите первые фото дома</span>
        </button>
      )}
    </Section>
  )
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="grid size-8 place-items-center rounded-full bg-surface/95 text-ink shadow-sm hover:bg-surface disabled:opacity-30">
      {children}
    </button>
  )
}
