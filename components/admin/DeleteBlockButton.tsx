'use client'

import { useTransition } from 'react'
import { X } from 'lucide-react'
import { deleteBlock } from '@/app/admin/actions'

export function DeleteBlockButton({ id }: { id: string }) {
  const [pending, run] = useTransition()
  return (
    <button
      className="grid size-7 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-accent"
      aria-label="Открыть даты"
      disabled={pending}
      onClick={() => run(async () => void (await deleteBlock(id)))}
    >
      <X size={15} />
    </button>
  )
}
