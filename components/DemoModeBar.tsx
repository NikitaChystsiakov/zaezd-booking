'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { SlidersHorizontal } from 'lucide-react'

// Панель только для демо: показывает, что владелец сам решает, что видит гость.
export function DemoModeBar({ showAvailability, priceMode }: { showAvailability: boolean; priceMode: 'exact' | 'from' | 'hidden' }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function set(key: string, value: string) {
    const next = new URLSearchParams(params)
    next.set(key, value)
    router.replace(`${pathname}?${next}#booking`, { scroll: false })
  }

  return (
    <div className="sticky top-0 z-30 border-b border-white/10 bg-[#1c1c1a] text-[#f0eee8]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 text-[13px]">
        <span className="flex items-center gap-2 font-medium">
          <SlidersHorizontal size={14} className="text-[#e0566c]" /> Демо. Режим владельца:
        </span>
        <label className="flex items-center gap-2">
          <span className="text-white/60">занятость</span>
          <select
            className="rounded-md bg-white/10 px-2 py-1"
            value={showAvailability ? '1' : '0'}
            onChange={(e) => set('avail', e.target.value)}
          >
            <option value="0">скрыта</option>
            <option value="1">видна гостю</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-white/60">цена</span>
          <select className="rounded-md bg-white/10 px-2 py-1" value={priceMode} onChange={(e) => set('price', e.target.value)}>
            <option value="exact">точная</option>
            <option value="from">ориентир</option>
            <option value="hidden">после звонка</option>
          </select>
        </label>
        <Link href="/admin" className="ml-auto rounded-md bg-[#e0566c] px-3 py-1 font-medium text-[#1a0a0d] hover:brightness-110">
          Открыть админку →
        </Link>
      </div>
    </div>
  )
}
