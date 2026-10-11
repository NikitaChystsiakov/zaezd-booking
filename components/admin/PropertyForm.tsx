'use client'

import { useRef, useState, useTransition } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { saveProperty, uploadHeroPhoto, type PropertyInput } from '@/app/admin/actions'
import { formatDay, todayISO, weekdayShort } from '@/lib/dates'
import { SaveBar, Section } from './ui'

export function PropertyForm({ slug, heroPhoto, initial }: { slug: string; heroPhoto: string | null; initial: PropertyInput }) {
  const [p, setP] = useState(initial)
  const [newHoliday, setNewHoliday] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [heroMsg, setHeroMsg] = useState<string | null>(null)
  const [pending, run] = useTransition()
  const [heroPending, runHero] = useTransition()
  const file = useRef<HTMLInputElement>(null)
  const set = <K extends keyof PropertyInput>(k: K, v: PropertyInput[K]) => setP((x) => ({ ...x, [k]: v }))
  const today = todayISO()
  const upcoming = p.holidays.filter((d) => d >= today)

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        run(async () => {
          const res = await saveProperty(p)
          setMsg(res.ok ? { ok: true, text: 'Сохранено — уже на сайте' } : { ok: false, text: res.error })
        })
      }}
    >
      <Section title="Первый экран" sub="Главное фото, название и пара строк о месте.">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface-2">
              {heroPhoto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={heroPhoto} alt="Главное фото" className="photo-grade size-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute inset-x-5 bottom-4 text-[#f3ece0]">
                <div className="display text-[28px] leading-tight">{p.tagline || p.name}</div>
              </div>
            </div>
            <input
              ref={file}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label="Загрузить главное фото"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (!f) return
                const form = new FormData()
                form.append('photo', f)
                runHero(async () => {
                  const res = await uploadHeroPhoto(form)
                  setHeroMsg(res.ok ? null : res.error)
                })
              }}
            />
            <button type="button" className="btn-ghost btn-sm mt-3" disabled={heroPending} onClick={() => file.current?.click()}>
              <ImagePlus size={15} /> {heroPending ? 'Загружаем…' : 'Заменить фото'}
            </button>
            {heroMsg && <p className="mt-2 text-sm text-alert">{heroMsg}</p>}
          </div>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="pf-name" label="Название" value={p.name} onChange={(v) => set('name', v)} />
              <Field id="pf-kind" label="Подпись над названием" value={p.kind} onChange={(v) => set('kind', v)} placeholder="Конная усадьба" />
            </div>
            <Field id="pf-tag" label="Заголовок" value={p.tagline} onChange={(v) => set('tagline', v)} />
            <div>
              <label className="label" htmlFor="pf-desc">Пара строк о месте</label>
              <textarea id="pf-desc" className="field h-auto min-h-28 py-3 leading-relaxed" value={p.description} onChange={(e) => set('description', e.target.value)} />
            </div>
          </div>
        </div>
      </Section>

      <Section title="Контакты и время">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="pf-ph" label="Телефон" value={p.phone} onChange={(v) => set('phone', v)} />
          <Field id="pf-ph2" label="Второй телефон" value={p.phone2} onChange={(v) => set('phone2', v)} />
          <Field id="pf-mail" label="Почта" value={p.email} onChange={(v) => set('email', v)} />
          <Field id="pf-ig" label="Instagram" value={p.instagram} onChange={(v) => set('instagram', v)} placeholder="без @" />
          <div className="sm:col-span-2">
            <Field id="pf-addr" label="Адрес" value={p.address} onChange={(v) => set('address', v)} />
          </div>
          <Field id="pf-in" label="Заезд с" value={p.checkInTime} onChange={(v) => set('checkInTime', v)} />
          <Field id="pf-out" label="Выезд до" value={p.checkOutTime} onChange={(v) => set('checkOutTime', v)} />
        </div>
      </Section>

      <Section title="Условия бронирования" sub="Каждый пункт — с новой строки. Гость видит их перед заявкой.">
        <textarea className="field h-auto min-h-56 py-3 leading-relaxed" value={p.bookingTerms} onChange={(e) => set('bookingTerms', e.target.value)} aria-label="Условия бронирования" />
      </Section>

      <Section title="Праздничные дни" sub="В эти даты работают тарифы с отметкой «только праздничные дни».">
        <div className="flex flex-wrap gap-2">
          {upcoming.map((d) => (
            <span key={d} className="inline-flex items-center gap-1 rounded-full bg-brass-soft py-1 pr-1.5 pl-3 text-[13px] font-semibold">
              {formatDay(d)} {d.slice(0, 4)}, {weekdayShort(d)}
              <button type="button" aria-label={`Убрать ${d}`} className="grid size-5 place-items-center rounded-full text-ink-3 hover:bg-line hover:text-ink" onClick={() => set('holidays', p.holidays.filter((x) => x !== d))}>
                <X size={12} />
              </button>
            </span>
          ))}
          {upcoming.length === 0 && <span className="text-sm text-ink-3">Праздников впереди нет</span>}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <input type="date" className="field w-auto" value={newHoliday} min={today} onChange={(e) => setNewHoliday(e.target.value)} aria-label="Новый праздничный день" />
          <button type="button" className="btn-ghost" disabled={!newHoliday} onClick={() => { if (newHoliday && !p.holidays.includes(newHoliday)) set('holidays', [...p.holidays, newHoliday].sort()); setNewHoliday('') }}>
            Добавить дату
          </button>
        </div>
      </Section>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-paper/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <SaveBar pending={pending} msg={msg} />
        <a href={`/u/${slug}`} target="_blank" className="text-sm font-semibold text-ink-2 underline underline-offset-4 hover:text-ink">
          Открыть страницу бронирования
        </a>
      </div>
    </form>
  )
}

function Field({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} className="field" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}
