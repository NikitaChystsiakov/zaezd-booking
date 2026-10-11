'use client'

import { useState, useTransition } from 'react'
import { saveSettings } from '@/app/admin/actions'
import { SaveBar, Section } from './ui'

type Settings = {
  showAvailability: boolean
  priceMode: 'exact' | 'from' | 'hidden'
  depositPercent: number
  callbackMinutes: number
  paymentDetails: string
  telegramChatId: string
}

const PRICE_MODES = [
  { v: 'exact', title: 'Точная цена', note: 'Расчёт по ночам и услугам, как в чеке' },
  { v: 'from', title: 'Ориентир', note: 'Примерная сумма, точную называете вы' },
  { v: 'hidden', title: 'После звонка', note: 'Цен на сайте нет — только заявка' },
] as const

export function SettingsForm({ initial }: { initial: Settings }) {
  const [s, setS] = useState(initial)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, run] = useTransition()
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => ({ ...p, [k]: v }))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        run(async () => {
          const res = await saveSettings(s)
          setMsg(res.ok ? { ok: true, text: 'Сохранено' } : { ok: false, text: res.error })
        })
      }}
    >
      <Section title="Что видит гость">
        <label className="flex cursor-pointer items-start justify-between gap-6 rounded-2xl border border-line p-5">
          <span>
            <span className="block font-semibold">Показывать занятые даты</span>
            <span className="mt-1 block text-sm text-ink-2">
              Выключите, если хотите сами обсуждать даты: гость выберет любые, а свободны ли они — скажете при звонке. У вас в заявке пересечения видны всегда.
            </span>
          </span>
          <input type="checkbox" className="peer sr-only" checked={s.showAvailability} onChange={(e) => set('showAvailability', e.target.checked)} />
          <span className="relative mt-1 h-6 w-11 shrink-0 rounded-full bg-line-strong transition-colors peer-checked:bg-ok peer-focus-visible:outline-2 peer-focus-visible:outline-brass after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
        </label>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {PRICE_MODES.map((m) => (
            <label key={m.v} className={`cursor-pointer rounded-2xl border p-4 transition-colors ${s.priceMode === m.v ? 'border-accent bg-accent-soft/50' : 'border-line hover:border-line-strong'}`}>
              <input type="radio" name="priceMode" className="sr-only" checked={s.priceMode === m.v} onChange={() => set('priceMode', m.v)} />
              <span className="font-semibold">{m.title}</span>
              <span className="mt-1 block text-xs text-ink-2">{m.note}</span>
            </label>
          ))}
        </div>

        <div className="mt-6 grid gap-4 border-t border-line pt-6 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="st-dep">Задаток, % от стоимости</label>
            <input id="st-dep" className="field tabular-nums" type="number" min={0} max={100} value={s.depositPercent} onChange={(e) => set('depositPercent', Number(e.target.value))} />
          </div>
          <div>
            <label className="label" htmlFor="st-cb">Обещаем ответить в течение, мин</label>
            <input id="st-cb" className="field tabular-nums" type="number" min={5} value={s.callbackMinutes} onChange={(e) => set('callbackMinutes', Number(e.target.value))} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="st-pay">Как внести задаток</label>
            <textarea id="st-pay" className="field h-auto min-h-20 py-3" placeholder="ЕРИП, номер карты или реквизиты — пришлёте гостю после звонка" value={s.paymentDetails} onChange={(e) => set('paymentDetails', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="st-tg">Telegram для уведомлений о заявках</label>
            <input id="st-tg" className="field" value={s.telegramChatId} onChange={(e) => set('telegramChatId', e.target.value)} placeholder="chat id, например 123456789" />
          </div>
        </div>

        <div className="mt-6">
          <SaveBar pending={pending} msg={msg} />
        </div>
      </Section>
    </form>
  )
}
