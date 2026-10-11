'use client'

import { useState, useTransition } from 'react'
import { addLeadNote } from '@/app/admin/actions'

export function NoteForm({ leadId }: { leadId: string }) {
  const [text, setText] = useState('')
  const [pending, start] = useTransition()

  function save(kind: 'note' | 'call') {
    start(async () => {
      const res = await addLeadNote(leadId, text, kind)
      if (res.ok) setText('')
    })
  }

  return (
    <div>
      <textarea
        className="field h-auto min-h-20 py-2"
        placeholder="Итог звонка или заметка: о чём договорились, что важно гостю"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-2 flex gap-2">
        <button className="btn-ink btn-sm flex-1" disabled={pending || !text.trim()} onClick={() => save('call')}>
          Итог звонка
        </button>
        <button className="btn-ghost btn-sm flex-1" disabled={pending || !text.trim()} onClick={() => save('note')}>
          Заметка
        </button>
      </div>
    </div>
  )
}
