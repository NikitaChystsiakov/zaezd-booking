'use client'

import { useEffect, useState, useTransition } from 'react'
import { Check, Clock, Share2 } from 'lucide-react'
import type { ContributionStatus } from '@prisma/client'
import { markPaid, pledge } from '@/app/o/[token]/actions'
import { formatMoney } from '@/lib/quote'

type C = { id: string; name: string; amount: number; status: ContributionStatus }

const STATUS: Record<ContributionStatus, { label: string; cls: string }> = {
  pledged: { label: 'собирается перевести', cls: 'text-ink-3' },
  marked_paid: { label: 'перевёл(а), ждём подтверждения', cls: 'text-warn' },
  confirmed: { label: 'получено', cls: 'text-ok' },
}

// Какие строки «мои» — помним в браузере, чтобы показать кнопку «Я перевёл» только своему участнику
const storageKey = (token: string) => `gurtom:mine:${token}`
function readMine(token: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(token)) ?? '[]')
  } catch {
    return []
  }
}

export function SplitPanel({ token, target, guests, paymentDetails, contributions }: { token: string; target: number; guests: number; paymentDetails: string | null; contributions: C[] }) {
  const [mine, setMine] = useState<string[]>([])
  const [name, setName] = useState('')
  const pledged = contributions.reduce((s, c) => s + c.amount, 0)
  const confirmed = contributions.filter((c) => c.status === 'confirmed').reduce((s, c) => s + c.amount, 0)
  const paid = contributions.filter((c) => c.status !== 'pledged').reduce((s, c) => s + c.amount, 0)
  const remaining = Math.max(0, target - pledged)
  const share = Math.max(1, Math.ceil(target / Math.max(2, Math.min(guests, 10)) / 5) * 5)
  const [amount, setAmount] = useState(Math.min(share, remaining || share))
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  useEffect(() => setMine(readMine(token)), [token])

  function remember(id: string) {
    const next = [...readMine(token), id]
    try {
      localStorage.setItem(storageKey(token), JSON.stringify(next))
    } catch {}
    setMine(next)
  }

  async function shareLink() {
    const url = location.href.split('?')[0]
    const text = 'Скидываемся на предоплату за отдых — отметь свою долю:'
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Скидываемся', text, url })
        return
      } catch {}
    }
    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-semibold">Скинуться компанией</div>
          <p className="mt-1 text-sm text-ink-2">Отправьте ссылку друзьям — каждый отметит свою долю.</p>
        </div>
        <button className="btn-ghost btn-sm" onClick={shareLink}>
          <Share2 size={14} /> Позвать друзей
        </button>
      </div>

      <div className="mt-5">
        <div className="relative h-3 overflow-hidden rounded-full bg-surface-2">
          <div className="absolute inset-y-0 left-0 rounded-full bg-[#cfe3d4]" style={{ width: `${Math.min(100, (paid / target) * 100)}%` }} />
          <div className="absolute inset-y-0 left-0 rounded-full bg-ok" style={{ width: `${Math.min(100, (confirmed / target) * 100)}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm">
          <span>
            <span className="font-semibold tabular-nums">{formatMoney(confirmed)}</span> <span className="text-ink-3">получено из {formatMoney(target)}</span>
          </span>
          {remaining > 0 ? <span className="text-ink-2">не хватает {formatMoney(remaining)}</span> : <span className="text-ok">вся сумма распределена</span>}
        </div>
      </div>

      {contributions.length > 0 && (
        <ul className="mt-5 divide-y divide-line rounded-lg border border-line">
          {contributions.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold">{c.name.slice(0, 1).toUpperCase()}</span>
              <span className="font-medium">{c.name}</span>
              <span className={`flex items-center gap-1 text-xs ${STATUS[c.status].cls}`}>
                {c.status === 'confirmed' ? <Check size={13} /> : c.status === 'marked_paid' ? <Clock size={13} /> : null}
                {STATUS[c.status].label}
              </span>
              <span className="ml-auto tabular-nums">{formatMoney(c.amount)}</span>
              {c.status === 'pledged' && mine.includes(c.id) && (
                <button
                  className="btn-ink btn-sm"
                  disabled={pending}
                  onClick={() => start(async () => void (await markPaid(token, c.id)))}
                >
                  Я перевёл(а)
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {remaining > 0 && (
        <form
          className="mt-5 grid gap-3 rounded-lg bg-surface-2 p-4 sm:grid-cols-[1fr_140px_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            start(async () => {
              setError(null)
              const res = await pledge(token, { name, amount })
              if (res.ok && res.id) {
                remember(res.id)
                setName('')
              } else if (!res.ok) setError(res.error)
            })
          }}
        >
          <div>
            <label className="label" htmlFor="sp-name">Ваше имя</label>
            <input id="sp-name" className="field" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="sp-amount">Сумма, BYN</label>
            <input id="sp-amount" className="field tabular-nums" type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <button className="btn-primary" disabled={pending}>
            Участвую
          </button>
          {error && <p className="text-sm text-accent sm:col-span-3" role="alert">{error}</p>}
        </form>
      )}

      {paymentDetails && (
        <div className="mt-5 text-sm">
          <div className="mb-1 font-medium">Куда переводить</div>
          <p className="whitespace-pre-wrap text-ink-2">{paymentDetails}</p>
          <p className="mt-2 text-xs text-ink-3">После перевода нажмите «Я перевёл(а)» — администратор проверит поступление и подтвердит.</p>
        </div>
      )}
    </div>
  )
}
