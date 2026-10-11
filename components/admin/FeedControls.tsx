'use client'

import { useState, useTransition } from 'react'
import { RefreshCw, Trash2 } from 'lucide-react'
import { addFeed, removeFeed, syncFeed } from '@/app/admin/actions'

export function FeedControls({ feedId }: { feedId: string }) {
  const [pending, run] = useTransition()
  return (
    <span className="flex gap-1">
      <button className="grid size-8 place-items-center rounded-md text-ink-2 hover:bg-surface-2" aria-label="Синхронизировать" disabled={pending} onClick={() => run(async () => void (await syncFeed(feedId)))}>
        <RefreshCw size={14} className={pending ? 'animate-spin' : ''} />
      </button>
      <button className="grid size-8 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-accent" aria-label="Удалить" disabled={pending} onClick={() => run(async () => void (await removeFeed(feedId)))}>
        <Trash2 size={14} />
      </button>
    </span>
  )
}

export function AddFeedForm({ unitId }: { unitId: string }) {
  const [label, setLabel] = useState('Куфар')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, run] = useTransition()
  return (
    <form
      className="mt-3 flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        run(async () => {
          setError(null)
          const res = await addFeed(unitId, label, url)
          if (res.ok) setUrl('')
          else setError(res.error)
        })
      }}
    >
      <select className="field h-9 w-32" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Откуда календарь">
        <option>Куфар</option>
        <option>Реалт</option>
        <option>Google</option>
        <option>Booking</option>
        <option>Другое</option>
      </select>
      <input className="field h-9 min-w-48 flex-1" placeholder="https://… .ics" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Ссылка на iCal" />
      <button className="btn-ghost btn-sm h-9" disabled={pending || !url}>Добавить</button>
      {error && <p className="w-full text-xs text-accent">{error}</p>}
    </form>
  )
}
