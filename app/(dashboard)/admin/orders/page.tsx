'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import s from './AdminOrdersPage.module.css'

import type {
    AdminOrdersResponse,
    DeliveryType,
    Order,
    OrderStatus,
} from '@/types/order'
import { DELIVERY_LABEL, STATUS_LABEL, formatMoney } from '@/types/order'

const DEFAULT_DATA: AdminOrdersResponse = {
    page: 1,
    pageSize: 20,
    total: 0,
    orders: [],
}

async function readJsonOrThrow(res: Response) {
    const ct = res.headers.get('content-type') || ''
    const text = await res.text()

    if (!ct.includes('application/json')) {
        throw new Error(
            `API вернул НЕ JSON (status ${res.status}). Начало ответа: ${text.slice(0, 120)}`
        )
    }

    const json = text ? JSON.parse(text) : null
    if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`)
    return json
}

export default function AdminOrdersPage() {
    const [mounted, setMounted] = useState(false)

    const [loading, setLoading] = useState(true)
    const [err, setErr] = useState<string | null>(null)

    const [data, setData] = useState<AdminOrdersResponse>(DEFAULT_DATA)

    const [q, setQ] = useState('')
    const [status, setStatus] = useState<OrderStatus | ''>('')
    const [deliveryType, setDeliveryType] = useState<DeliveryType | ''>('')

    const [selected, setSelected] = useState<Order | null>(null)

    const canPrev = data.page > 1
    const canNext = data.page * data.pageSize < data.total

    const queryString = useMemo(() => {
        const p = new URLSearchParams()
        p.set('page', String(data.page))
        p.set('pageSize', String(data.pageSize))
        if (q.trim()) p.set('q', q.trim())
        if (status) p.set('status', status)
        if (deliveryType) p.set('delivery_type', deliveryType)
        return p.toString()
    }, [data.page, data.pageSize, q, status, deliveryType])

    async function load() {
        setLoading(true)
        setErr(null)

        try {
            const res = await fetch(`/api/v1/admin/orders?${queryString}`, {
                cache: 'no-store',
            })
            const json = await readJsonOrThrow(res)

            setData({
                page: Number(json?.page ?? 1),
                pageSize: Number(json?.pageSize ?? 20),
                total: Number(json?.total ?? 0),
                orders: Array.isArray(json?.orders) ? json.orders : [],
            })
        } catch (e: any) {
            setErr(e?.message ?? 'Ошибка загрузки')
            setData((prev) => ({
                ...prev,
                orders: Array.isArray(prev.orders) ? prev.orders : [],
            }))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => setMounted(true), [])
    useEffect(() => {
        load()
    }, [queryString])

    function openOrder(o: Order) {
        setSelected(o)
    }

    function closeModal() {
        setSelected(null)
    }

    // ESC закрывает модалку
    useEffect(() => {
        if (!selected) return
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeModal()
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [selected])

    const modal =
        selected ? (
            <div className={s.modalOverlay} onMouseDown={closeModal}>
                <div className={s.modalCard} onMouseDown={(e) => e.stopPropagation()}>
                    <div className={s.modalHeader}>
                        <div>
                            <div className={s.modalTitle}>Заказ № {selected.id}</div>
                            <div className={s.modalSubtitle}>
                                {new Date(selected.created_at).toLocaleString('ru-RU')}
                            </div>
                        </div>

                        <button
                            className={s.iconBtn}
                            onClick={closeModal}
                            aria-label="close"
                            type="button"
                        >
                            ✕
                        </button>
                    </div>

                    <div className={s.modalGrid}>
                        <div className={s.kv}>
                            <div className={s.k}>Статус</div>
                            <div className={s.v}>
                                <span className={`${s.badge} ${s['st_' + selected.status]}`}>
                                    {STATUS_LABEL[selected.status]}
                                </span>
                            </div>
                        </div>

                        <div className={s.kv}>
                            <div className={s.k}>Доставка</div>
                            <div className={s.v}>{DELIVERY_LABEL[selected.delivery_type]}</div>
                        </div>

                        <div className={s.kv}>
                            <div className={s.k}>Сумма</div>
                            <div className={s.v}>{formatMoney(selected.total_amount)}</div>
                        </div>

                        <div className={s.kv} style={{ gridColumn: '1 / -1' }}>
                            <div className={s.k}>Клиент</div>
                            <div className={s.v}>
                                {[
                                    selected.customer_last_name,
                                    selected.customer_name,
                                    selected.customer_second_name,
                                ]
                                    .filter(Boolean)
                                    .join(' ') || '—'}
                                <div className={s.subline}>
                                    {selected.customer_phone || '—'} {' '}
                                    {selected.customer_email || '—'}
                                </div>
                            </div>
                        </div>

                        {selected.delivery_type === 'pickup' ? (
                            <div className={s.kv} style={{ gridColumn: '1 / -1' }}>
                                <div className={s.k}>Магазин</div>
                                <div className={s.v}>
                                    {selected.shop
                                        ? `${selected.shop.city}, ${selected.shop.street}`
                                        : '—'}
                                </div>
                            </div>
                        ) : (
                            <div className={s.kv} style={{ gridColumn: '1 / -1' }}>
                                <div className={s.k}>Адрес</div>
                                <div className={s.v}>
                                    {selected.address
                                        ? [
                                            selected.address.city,
                                            selected.address.street,
                                            `д. ${selected.address.house}`,
                                        ]
                                            .filter(Boolean)
                                            .join(', ')
                                        : '—'}

                                    {selected.address?.apartment ? (
                                        <div className={s.subline}>
                                            кв. {selected.address.apartment}
                                        </div>
                                    ) : null}

                                    {selected.address?.entrance || selected.address?.floor ? (
                                        <div className={s.subline}>
                                            {selected.address?.entrance
                                                ? `подъезд ${selected.address.entrance}`
                                                : ''}
                                            {selected.address?.entrance && selected.address?.floor
                                                ? '  '
                                                : ''}
                                            {selected.address?.floor ? `этаж ${selected.address.floor}` : ''}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        )}

                        {selected.note ? (
                            <div className={s.kv} style={{ gridColumn: '1 / -1' }}>
                                <div className={s.k}>Комментарий</div>
                                <div className={s.v}>{selected.note}</div>
                            </div>
                        ) : null}
                    </div>

                    <div className={s.itemsBlock}>
                        <div className={s.itemsTitle}>Позиции</div>

                        <div className={s.itemsList}>
                            {(selected.items ?? []).map((it) => {
                                const name = it.productVariant?.product?.name ?? 'Товар'
                                const mat = it.productVariant?.material?.name ?? 'Материал'
                                return (
                                    <div key={it.id} className={s.itemRow}>
                                        <div className={s.itemMain}>
                                            <div className={s.itemName}>
                                                {name}{' '}
                                                <span className={s.itemMuted}>
                                                    ({mat}) {it.productVariant?.sku ? ` ${it.productVariant.sku}` : ''}
                                                </span>
                                            </div>
                                            <div className={s.itemMeta}>
                                                {it.quantity} × {formatMoney(it.unit_price)}
                                            </div>
                                        </div>
                                        <div className={s.itemTotal}>{formatMoney(it.line_total)}</div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        ) : null

    const orders = data.orders ?? []

    return (
        <div className={s.wrapper}>
            <div className={s.card}>
                <div className={s.headerRow}>
                    <div>
                        <h2 className={s.title}>Заказы</h2>
                        <div className={s.subtitle}>Всего: {data.total}</div>
                    </div>

                    <button className={s.secondaryBtn} onClick={load} disabled={loading} type="button">
                        Обновить
                    </button>
                </div>

                <div className={s.filters}>
                    <input
                        className={s.search}
                        placeholder="Поиск: ID, телефон, email, имя…"
                        value={q}
                        onChange={(e) => {
                            setData((prev) => ({ ...prev, page: 1 }))
                            setQ(e.target.value)
                        }}
                    />

                    <select
                        className={s.select}
                        value={status}
                        onChange={(e) => {
                            setData((prev) => ({ ...prev, page: 1 }))
                            setStatus(e.target.value as any)
                        }}
                    >
                        <option value="">Все статусы</option>
                        {Object.entries(STATUS_LABEL).map(([key, label]) => (
                            <option key={key} value={key}>
                                {label}
                            </option>
                        ))}
                    </select>

                    <select
                        className={s.select}
                        value={deliveryType}
                        onChange={(e) => {
                            setData((prev) => ({ ...prev, page: 1 }))
                            setDeliveryType(e.target.value as any)
                        }}
                    >
                        <option value="">Любая доставка</option>
                        <option value="pickup">Самовывоз</option>
                        <option value="home_delivery">Доставка</option>
                    </select>
                </div>

                {loading ? <p className={s.muted}>Загрузка…</p> : null}
                {err ? <p className={s.error}>{err}</p> : null}

                <div className={s.tableWrapper}>
                    <table className={s.table}>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Дата</th>
                                <th>Клиент</th>
                                <th>Доставка</th>
                                <th>Сумма</th>
                                <th>Статус</th>
                                <th />
                            </tr>
                        </thead>

                        <tbody>
                            {orders.map((o) => {
                                const customer =
                                    [o.customer_last_name, o.customer_name, o.customer_second_name]
                                        .filter(Boolean)
                                        .join(' ') || '—'

                                const deliverySub =
                                    o.delivery_type === 'pickup'
                                        ? o.shop
                                            ? `${o.shop.city}, ${o.shop.street}`
                                            : '—'
                                        : o.address
                                            ? `${o.address.city}, ${o.address.street}, д. ${o.address.house}`
                                            : '—'

                                return (
                                    <tr key={o.id}>
                                        <td>{o.id}</td>

                                        <td>{new Date(o.created_at).toLocaleString('ru-RU')}</td>

                                        <td>
                                            <div className={s.cellMain}>{customer}</div>
                                            <div className={s.cellSub}>
                                                {o.customer_phone || '—'}  {o.customer_email || '—'}
                                            </div>
                                        </td>

                                        <td>
                                            <div className={s.cellMain}>{DELIVERY_LABEL[o.delivery_type]}</div>
                                            <div className={s.cellSub}>{deliverySub}</div>
                                        </td>

                                        <td>{formatMoney(o.total_amount)}</td>

                                        <td>
                                            <span className={`${s.badge} ${s['st_' + o.status]}`}>
                                                {STATUS_LABEL[o.status]}
                                            </span>
                                        </td>

                                        <td className={s.actionsCell}>
                                            <button className={s.editBtn} onClick={() => openOrder(o)} type="button">
                                                Подробнее
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}

                            {!loading && orders.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className={s.emptyRow}>
                                        Заказов не найдено
                                    </td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>

                <div className={s.pager}>
                    <button
                        className={s.secondaryBtn}
                        disabled={!canPrev || loading}
                        onClick={() => setData((prev) => ({ ...prev, page: prev.page - 1 }))}
                        type="button"
                    >
                        ← Назад
                    </button>

                    <div className={s.pagerInfo}>
                        Страница <b>{data.page}</b>  Показано <b>{orders.length}</b> из{' '}
                        <b>{data.total}</b>
                    </div>

                    <button
                        className={s.secondaryBtn}
                        disabled={!canNext || loading}
                        onClick={() => setData((prev) => ({ ...prev, page: prev.page + 1 }))}
                        type="button"
                    >
                        Вперёд →
                    </button>
                </div>
            </div>

            {mounted && modal ? createPortal(modal, document.body) : null}
        </div>
    )
}
