'use client'

import { useTransition } from 'react'
import { deleteBlock } from '@/app/admin/actions'

export function DeleteBlockButton({ id }: { id: string }) {
  const [pending, run] = useTransition()
  return (
    <button className="btn-quiet btn-sm" disabled={pending} onClick={() => run(async () => void (await deleteBlock(id)))}>
      Открыть даты
    </button>
  )
}
