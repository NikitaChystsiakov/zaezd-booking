'use client'

import s from './UserOrders.module.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '@/hooks/useToast'
import type { UserOrderInfo } from '@/types/order'
import { STATUS_LABEL } from '@/types/order'

function formatMoney(n: number) {
  return (
    (Number.isFinite(n) ? n : 0).toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' BYN'
  )
}

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function displayOrderLabel(o: UserOrderInfo) {
  const tail = String(o.id).slice(-6).padStart(6, '0')
  return `Заказ № ${tail}`
}

type PatchedOrder = UserOrderInfo & {
  hasReceipt?: boolean
  has_receipt?: boolean
  invoice_available?: boolean
  receiptUrl?: string | null
  items?: Array<any>
  total?: number
}

export default function UserOrders() {
  const [orders, setOrders] = useState<PatchedOrder[]>([])
  const [loading, setLoading] = useState(true)

  const [page, setPage] = useState(1) 
  const pageSize = 1

  const [open, setOpen] = useState(false)

  const { show } = useToast()
  const didFetch = useRef(false)

  useEffect(() => {
    if (didFetch.current) return
    didFetch.current = true

    ;(async () => {
      try {
        const res = await fetch('/api/v1/orders/my', { cache: 'no-store' })
        if (!res.ok) throw new Error('Ошибка загрузки заказов')
        const data = await res.json()
        const list = Array.isArray(data?.orders) ? data.orders : []
        setOrders(list)
      } catch (err) {
        show({
          title: 'Ошибка',
          description: err instanceof Error ? err.message : 'Не удалось получить заказы',
          duration: 6000,
        })
      } finally {
        setLoading(false)
      }
    })()
  }, [show])

  const totalPages = Math.max(1, Math.ceil(orders.length / pageSize))
  const safePage = Math.min(Math.max(page, 1), totalPages)

  const current = useMemo(() => {
    if (orders.length === 0) return null
    const idx = (safePage - 1) * pageSize
    return orders[idx] ?? null
  }, [orders, safePage])

  const canPrev = safePage > 1
  const canNext = safePage < totalPages

  if (loading) {
    return (
      <div className={s.card}>
        <div className={s.headerRow}>
          <div className={s.titleWrap}>
            <h2 className={s.title}>Мои заказы</h2>
          </div>
        </div>
        <div className={s.skeletonList}>
          <div className={s.skeleton} />
          <div className={s.skeleton} />
          <div className={s.skeleton} />
        </div>
      </div>
    )
  }

  if (!current) {
    return (
      <div className={s.card}>
        <div className={s.headerRow}>
          <div className={s.titleWrap}>
            <h2 className={s.title}>Мои заказы</h2>
          </div>

          <button type="button" className={s.secondaryBtn} onClick={() => window.location.reload()}>
            Обновить
          </button>
        </div>

        <div className={s.empty}>
          <div className={s.emptyIcon} aria-hidden>📦</div>
          <div className={s.emptyTitle}>Пока заказов нет</div>
          <div className={s.emptyText}>Когда вы оформите заказ, он появится здесь.</div>
        </div>
      </div>
    )
  }

  const canReceipt =
    !!current.hasReceipt || !!current.has_receipt || !!current.invoice_available

  const receiptHref =
    (current.receiptUrl && current.receiptUrl.trim()) || `/api/v1/orders/${current.id}/receipt`

  return (
    <div className={s.card}>
      <div className={s.headerRow}>
        <div className={s.titleWrap}>
          <h2 className={s.title}>Мои заказы</h2>
          <div className={s.subtitleSmall}>
            {orders.length > 0 ? `Заказ ${safePage} из ${totalPages}` : ''}
          </div>
        </div>

        <button type="button" className={s.secondaryBtn} onClick={() => window.location.reload()}>
          Обновить
        </button>
      </div>

      <div className={s.list}>
        <div className={s.order}>
          <div className={s.orderTop}>
            <div className={s.orderMain}>
              <div className={s.orderTitleRow}>
                <div className={s.orderTitle}>{displayOrderLabel(current)}</div>
                <span className={`${s.badge} ${s['st_' + current.status]}`}>
                  {STATUS_LABEL?.[current.status] ?? current.status}
                </span>
              </div>

              <div className={s.orderMeta}>
                <span className={s.muted}>Дата:</span> {formatDate(current.created_at)}
                <span className={s.money}>Сумма: {formatMoney(Number(current.total) || 0)}</span>
              </div>
            </div>

            <div className={s.actions}>
              <button type="button" className={s.secondaryBtn} onClick={() => setOpen((v) => !v)}>
                {open ? 'Скрыть состав' : 'Состав'}
              </button>

              <a
                className={`${s.primaryBtn} ${!canReceipt ? s.disabledLink : ''}`}
                href={canReceipt ? receiptHref : '#'}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!canReceipt}
                onClick={(e) => {
                  if (!canReceipt) {
                    e.preventDefault()
                    show({
                      title: 'Чек недоступен',
                      description: 'Чек появится после подтверждения оплаты.',
                      duration: 4000,
                    })
                  }
                }}
              >
                Скачать чек
              </a>
            </div>
          </div>

          {open ? (
            <div className={s.items}>
              {(current.items ?? []).length === 0 ? (
                <div className={s.muted}>Позиции не найдены</div>
              ) : (
                <div className={s.itemsList}>
                  {current.items.map((it: any, idx: number) => (
                    <div key={`${current.id}-${idx}`} className={s.itemRow}>
                      <div className={s.itemLeft}>
                        <div className={s.itemName}>
                          {it.name}{' '}
                          <span className={s.itemMuted}>({it.materialName ?? it.material ?? '—'})</span>
                        </div>
                        <div className={s.itemMeta}>{it.quantity} шт.</div>
                      </div>

                      <div className={s.itemTotal}>
                        {Number.isFinite(Number(it.line_total))
                          ? formatMoney(Number(it.line_total))
                          : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Pagination */}
      <div className={s.pager}>
        <button
          type="button"
          className={s.secondaryBtn}
          disabled={!canPrev}
          onClick={() => {
            setOpen(false)
            setPage((p) => Math.max(1, p - 1))
          }}
        >
          ← Назад
        </button>

        <div className={s.pagerInfo}>
          Страница <b>{safePage}</b> из <b>{totalPages}</b>
        </div>

        <button
          type="button"
          className={s.secondaryBtn}
          disabled={!canNext}
          onClick={() => {
            setOpen(false)
            setPage((p) => Math.min(totalPages, p + 1))
          }}
        >
          Вперёд →
        </button>
      </div>
    </div>
  )
}
