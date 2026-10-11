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
      <textarea className="field h-auto min-h-24 py-3" placeholder="О чём договорились с гостем" value={text} onChange={(e) => setText(e.target.value)} aria-label="Заметка к заявке" />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button className="btn-primary btn-sm" disabled={pending || !text.trim()} onClick={() => save('call')}>
          Итог звонка
        </button>
        <button className="btn-ghost btn-sm" disabled={pending || !text.trim()} onClick={() => save('note')}>
          Заметка
        </button>
      </div>
    </div>
  )
}
