'use client'

import { useState, useTransition } from 'react'
import { saveSettings } from '@/app/admin/actions'

type Settings = {
  showAvailability: boolean
  priceMode: 'exact' | 'from' | 'hidden'
  prepaymentPercent: number
  callbackMinutes: number
  paymentDetails: string
  telegramChatId: string
}

const PRICE_MODES = [
  { v: 'exact', title: 'Точная цена', note: 'Гость видит полный расчёт по ночам и услугам' },
  { v: 'from', title: 'Ориентир', note: 'Гость видит примерную сумму, точную называете вы' },
  { v: 'hidden', title: 'После звонка', note: 'Цен на сайте нет — только заявка' },
] as const

export function SettingsForm({ initial }: { initial: Settings }) {
  const [s, setS] = useState(initial)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, run] = useTransition()
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((prev) => ({ ...prev, [k]: v }))

  return (
    <form
      className="card space-y-6 p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault()
        run(async () => {
          const res = await saveSettings(s)
          setMsg(res.ok ? { ok: true, text: 'Сохранено' } : { ok: false, text: res.error })
        })
      }}
    >
      <div>
        <h2 className="font-semibold">Что видит гость на сайте</h2>
        <label className="mt-4 flex items-start gap-3 rounded-lg border border-line p-4">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={s.showAvailability} onChange={(e) => set('showAvailability', e.target.checked)} />
          <span>
            <span className="font-medium">Показывать занятые даты</span>
            <span className="block text-sm text-ink-2">Если выключено, гость выбирает любые даты, а свободны ли они — вы скажете при звонке. Занятость всё равно учитывается у вас в карточке заявки.</span>
          </span>
        </label>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {PRICE_MODES.map((m) => (
            <label key={m.v} className={`cursor-pointer rounded-lg border p-4 ${s.priceMode === m.v ? 'border-ink bg-surface-2' : 'border-line'}`}>
              <input type="radio" name="priceMode" className="sr-only" checked={s.priceMode === m.v} onChange={() => set('priceMode', m.v)} />
              <span className="font-medium">{m.title}</span>
              <span className="mt-1 block text-xs text-ink-2">{m.note}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="st-cb">Перезвонить по новой заявке в течение, мин</label>
          <input id="st-cb" className="field" type="number" min={5} value={s.callbackMinutes} onChange={(e) => set('callbackMinutes', Number(e.target.value))} />
          <p className="mt-1 text-xs text-ink-3">Это обещание гостю на сайте; просроченные заявки подсветятся красным</p>
        </div>
        <div>
          <label className="label" htmlFor="st-pp">Предоплата по умолчанию, %</label>
          <input id="st-pp" className="field" type="number" min={0} max={100} value={s.prepaymentPercent} onChange={(e) => set('prepaymentPercent', Number(e.target.value))} />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="st-pay">Как перевести предоплату</label>
        <textarea id="st-pay" className="field h-auto min-h-20 py-2" placeholder="ЕРИП, номер карты, реквизиты" value={s.paymentDetails} onChange={(e) => set('paymentDetails', e.target.value)} />
        <p className="mt-1 text-xs text-ink-3">Показывается гостям в КП рядом со сбором предоплаты</p>
      </div>

      <div>
        <label className="label" htmlFor="st-tg">Telegram chat id для уведомлений</label>
        <input id="st-tg" className="field" value={s.telegramChatId} onChange={(e) => set('telegramChatId', e.target.value)} placeholder="например, 123456789" />
        <p className="mt-1 text-xs text-ink-3">Новые заявки, выбор варианта в КП и переводы от компании придут сюда</p>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>Сохранить</button>
        {msg && <span className={`text-sm ${msg.ok ? 'text-ok' : 'text-accent'}`}>{msg.text}</span>}
      </div>
    </form>
  )
}
