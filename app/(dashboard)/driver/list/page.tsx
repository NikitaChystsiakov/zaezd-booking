// app/(driver)/driver/page.tsx
"use client";

import { Fragment, useEffect, useState } from "react";
import { useToast } from "@/hooks/useToast";
import s from "./DriverOrders.module.css";

type Address = {
    id: number | string;
    city: string;
    street: string;
    house_number: string | null;
    apartment: string | null;
    entrance: string | null;
    floor: string | null;
    comment: string | null;
};

type Shop = {
    id: number | string;
    name: string | null;
    city: string;
    street: string;
    phone: string | null;
    email: string | null;
};

type ProductVariantBrief = {
    id: number | string;
    sku: string | null;
    price: number | string | null;
    product?: { name: string | null } | null;
    material?: { name: string | null } | null;
};

type OrderItem = {
    id: number | string;
    quantity: number;
    is_from_shop_stock: boolean;
    product_variant_id: number | string;
    productVariant: ProductVariantBrief | null;
};

type DriverOrder = {
    id: number | string;
    created_at: string;
    status:
    | "created"
    | "in_production"
    | "ready_to_ship"
    | "in_transit"
    | "delivered"
    | "cancelled"
    | string;
    delivery_type: string;
    customer_name: string | null;
    customer_phone: string | null;
    total_amount: number | string;
    address: Address | null;
    shop: Shop | null; // Добавляем магазин
    items: OrderItem[];
};

type ApiResponse = {
    orders: DriverOrder[];
    message?: string;
};

const money = (v: any) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return n.toFixed(2);
};

const formatStatus = (s: string) => {
    switch (s) {
        case "ready_to_ship":
            return "Готов к отгрузке";
        case "in_transit":
            return "В пути";
        case "delivered":
            return "Доставлен";
        case "cancelled":
            return "Отменён";
        default:
            return s;
    }
};

const formatDeliveryType = (t: string) => {
    if (t === "pickup") return "Самовывоз";
    if (t === "home_delivery") return "Доставка";
    return t || "—";
};

const formatAddress = (order: DriverOrder) => {
    // Если доставка домой и есть адрес
    if (order.delivery_type === "home_delivery" && order.address) {
        const parts = [
            order.address.city,
            order.address.street,
            order.address.house_number && `д. ${order.address.house_number}`,
            order.address.apartment && `кв. ${order.address.apartment}`,
            order.address.entrance && `подъезд ${order.address.entrance}`,
            order.address.floor && `этаж ${order.address.floor}`,
        ].filter(Boolean);
        
        return parts.join(", ");
    }
    
    // Если самовывоз и есть магазин
    if (order.delivery_type === "pickup" && order.shop) {
        const parts = [
            order.shop.city,
            order.shop.street,
            order.shop.name && `(${order.shop.name})`
        ].filter(Boolean);
        
        return parts.join(", ");
    }
    
    return "—";
};

const getAddressComment = (order: DriverOrder) => {
    if (order.delivery_type === "home_delivery" && order.address?.comment) {
        return order.address.comment;
    }
    return null;
};

export default function DriverOrdersPage() {
    const toast = useToast();

    const [orders, setOrders] = useState<DriverOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [savingId, setSavingId] = useState<string | number | null>(null);
    const [openOrders, setOpenOrders] = useState<Record<string, boolean>>({});

    // Модальное окно для принятия заказа
    const [showModal, setShowModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<DriverOrder | null>(null);
    const [routeHint, setRouteHint] = useState("");
    const [comment, setComment] = useState("");

    // пагинация
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    async function load() {
        try {
            setErr(null);
            setLoading(true);

            const res = await fetch("/api/v1/driver/orders", {
                credentials: "include",
            });
            const json: ApiResponse = await res.json();

            if (!res.ok) {
                throw new Error(json.message || "Ошибка загрузки заказов");
            }

            setOrders(Array.isArray(json.orders) ? json.orders : []);
            setPage(1);
        } catch (e: any) {
            const msg = e?.message ?? "Ошибка загрузки заказов";
            setErr(msg);
            toast.show({ title: "Ошибка", description: msg });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    const totalOrders = orders.length;
    const totalPages = totalOrders === 0 ? 1 : Math.ceil(totalOrders / pageSize);

    const startIndex = totalOrders === 0 ? 0 : (page - 1) * pageSize;
    const endIndex = totalOrders === 0 ? 0 : Math.min(startIndex + pageSize, totalOrders);
    const pagedOrders = orders.slice(startIndex, endIndex);

    const handleOpenModal = (order: DriverOrder) => {
        setSelectedOrder(order);
        setRouteHint("");
        setComment("");
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedOrder(null);
        setRouteHint("");
        setComment("");
    };

    async function takeOrder() {
        if (!selectedOrder) return;

        try {
            setSavingId(selectedOrder.id);

            const res = await fetch("/api/v1/driver/orders", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    orderId: Number(selectedOrder.id),
                    routeHint: routeHint.trim() || null,
                    comment: comment.trim() || null,
                }),
            });

            const json = await res.json();
            if (!res.ok) {
                throw new Error(json?.message || `Ошибка ${res.status}: ${json?.error || 'Unknown error'}`);
            }

            toast.show({
                title: "Заказ принят",
                description: `Заказ ${selectedOrder.id} взят в доставку. Shipment ID: ${json.shipmentId || 'N/A'}`,
            });

            handleCloseModal();
            await load();
        } catch (e: any) {
            toast.show({
                title: "Ошибка",
                description: e?.message ?? "Не удалось принять заказ",
            });
        } finally {
            setSavingId(null);
        }
    }

    const toggleOpen = (orderId: number | string) => {
        setOpenOrders((prev) => {
            const id = String(orderId);
            return { ...prev, [id]: !prev[id] };
        });
    };

    const handlePrev = () => {
        setPage((p) => Math.max(1, p - 1));
    };

    const handleNext = () => {
        setPage((p) => Math.min(totalPages, p + 1));
    };

    if (loading) {
        return (
            <section className={s.wrapper}>
                <div className={s.card}>
                    <p className={s.muted}>Загрузка заказов…</p>
                </div>
            </section>
        );
    }

    if (err) {
        return (
            <section className={s.wrapper}>
                <div className={s.card}>
                    <p className={s.error}>{err}</p>
                </div>
            </section>
        );
    }

    return (
        <section className={s.wrapper}>
            <div className={s.card}>
                <div className={s.headerRow}>
                    <h1 className={s.title}>Заказы для доставки</h1>
                    <div className={s.headerActions}>
                        <button
                            type="button"
                            className={s.secondaryBtn}
                            onClick={load}
                            disabled={loading}
                        >
                            Обновить
                        </button>
                    </div>
                </div>

                {/* Десктоп / планшет — таблица */}
                <div className={s.tableContainer}>
                    <div className={s.tableWrapper}>
                        <table className={s.table}>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Клиент</th>
                                    <th>Адрес доставки/магазин</th>
                                    <th>Тип доставки</th>
                                    <th>Статус</th>
                                    <th>Сумма</th>
                                    <th>Товары</th>
                                    <th className={s.actionsCell}>Действие</th>
                                </tr>
                            </thead>
                            <tbody>
                                {totalOrders === 0 && (
                                    <tr>
                                        <td colSpan={8} className={s.placeholder}>
                                            Нет доступных заказов для доставки.
                                        </td>
                                    </tr>
                                )}

                                {pagedOrders.map((o) => {
                                    const orderId = String(o.id);
                                    const isOpen = !!openOrders[orderId];
                                    const items = Array.isArray(o.items) ? o.items : [];
                                    const addressComment = getAddressComment(o);

                                    return (
                                        <Fragment key={orderId}>
                                            <tr>
                                                <td>{orderId}</td>
                                                <td>
                                                    <div>{o.customer_name || "—"}</div>
                                                    <div className={s.phone}>{o.customer_phone || ""}</div>
                                                </td>
                                                <td>
                                                    <div className={s.address}>
                                                        {formatAddress(o)}
                                                    </div>
                                                    {addressComment && (
                                                        <div className={s.comment}>
                                                            {addressComment}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    {formatDeliveryType(o.delivery_type)}
                                                    {o.delivery_type === "pickup" && o.shop && (
                                                        <div className={s.shopInfo}>
                                                            Магазин: {o.shop.name || `${o.shop.id}`}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <span
                                                        className={`${s.statusBadge} ${o.status === "ready_to_ship"
                                                                ? s.statusReady
                                                                : ""
                                                            }`}
                                                    >
                                                        {formatStatus(o.status)}
                                                    </span>
                                                </td>
                                                <td>{money(o.total_amount)} BYN</td>
                                                <td>
                                                    {items.length === 0 ? (
                                                        <span className={s.muted}>—</span>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className={s.secondaryBtn}
                                                            onClick={() => toggleOpen(orderId)}
                                                        >
                                                            {isOpen
                                                                ? "Скрыть "
                                                                : `Показать `}
                                                        </button>
                                                    )}
                                                </td>
                                                <td className={s.actionsCell}>
                                                    <button
                                                        type="button"
                                                        className={s.primaryBtn}
                                                        onClick={() => handleOpenModal(o)}
                                                        disabled={savingId === orderId}
                                                    >
                                                        {savingId === orderId ? "Принимаем…" : "Принять заказ"}
                                                    </button>
                                                </td>
                                            </tr>

                                            {isOpen && items.length > 0 && (
                                                <tr key={`${orderId}-items`}>
                                                    <td colSpan={8} className={s.itemsCell}>
                                                        <div className={s.itemsList}>
                                                            {items.map((it) => {
                                                                const pv = it.productVariant;
                                                                const name = pv?.product?.name ?? "";
                                                                const material = pv?.material?.name
                                                                    ? `  ${pv.material.name}`
                                                                    : "";
                                                                const sku = pv?.sku ?? "—";

                                                                return (
                                                                    <div
                                                                        key={String(it.id)}
                                                                        className={s.itemRow}
                                                                    >
                                                                        <div className={s.itemTitle}>
                                                                            {name || "Без названия"}
                                                                            {material && (
                                                                                <span className={s.muted}>
                                                                                 Материал: {material}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className={s.itemMeta}>
                                                                            <span>
                                                                                SKU: <b>{sku}</b>
                                                                            </span>
                                                                            <span>
                                                                                Количество: <b>{it.quantity}</b>
                                                                            </span>
                                                                            <span>
                                                                                Цена: <b>{money(pv?.price)} BYN</b>
                                                                            </span>
                                                                            <span
                                                                                className={
                                                                                    it.is_from_shop_stock
                                                                                        ? s.badgeStock
                                                                                        : s.badgeCustom
                                                                                }
                                                                            >
                                                                                {it.is_from_shop_stock
                                                                                    ? "Со склада"
                                                                                    : "Под заказ"}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Мобильные карточки */}
                <div className={s.mobileList}>
                    {totalOrders === 0 && (
                        <div className={s.placeholder}>
                            Нет доступных заказов для доставки.
                        </div>
                    )}

                    {pagedOrders.map((o) => {
                        const orderId = String(o.id);
                        const items = Array.isArray(o.items) ? o.items : [];
                        const addressComment = getAddressComment(o);

                        return (
                            <div key={orderId} className={s.orderCard}>
                                <div className={s.orderHeader}>
                                    <div className={s.orderTitle}>Заказ {orderId}</div>
                                    <div className={s.orderStatusRow}>
                                        <span
                                            className={`${s.statusBadge} ${o.status === "ready_to_ship"
                                                    ? s.statusReady
                                                    : ""
                                                }`}
                                        >
                                            {formatStatus(o.status)}
                                        </span>
                                    </div>
                                </div>

                                <div className={s.orderBody}>
                                    <div className={s.orderMeta}>
                                        Клиент: {o.customer_name || "—"} • {o.customer_phone || "—"}
                                    </div>
                                    <div className={s.orderMeta}>
                                        Адрес: {formatAddress(o)}
                                    </div>
                                    {addressComment && (
                                        <div className={s.orderMeta}>
                                            Комментарий: {addressComment}
                                        </div>
                                    )}
                                    <div className={s.orderMeta}>
                                        Доставка: {formatDeliveryType(o.delivery_type)}
                                        {o.delivery_type === "pickup" && o.shop && (
                                            <span> • Магазин: {o.shop.name || `${o.shop.id}`}</span>
                                        )}
                                    </div>
                                    <div className={s.orderMeta}>
                                        Сумма: <b>{money(o.total_amount)} BYN</b>
                                    </div>
                                </div>

                                {items.length > 0 && (
                                    <div className={s.itemsBlock}>
                                        <button
                                            type="button"
                                            className={s.secondaryBtn}
                                            onClick={() => toggleOpen(orderId)}
                                        >
                                            {openOrders[orderId]
                                                ? "Скрыть позиции"
                                                : `Показать позиции (${items.length})`}
                                        </button>

                                        {openOrders[orderId] && (
                                            <div className={s.itemsListMobile}>
                                                {items.map((it) => {
                                                    const pv = it.productVariant;
                                                    const name = pv?.product?.name ?? "";
                                                    const material = pv?.material?.name
                                                        ? `  ${pv.material.name}`
                                                        : "";
                                                    const sku = pv?.sku ?? "—";

                                                    return (
                                                        <div key={String(it.id)} className={s.itemPill}>
                                                            <div className={s.itemPillTitle}>
                                                                {name || "Без названия"}
                                                                {material && (
                                                                    <span className={s.muted}>{material}</span>
                                                                )}
                                                            </div>
                                                            <div className={s.itemPillMeta}>
                                                                SKU: {sku} Количество: {it.quantity} Цена:{" "}
                                                                {money(pv?.price)} BYN
                                                            </div>
                                                            <div
                                                                className={
                                                                    it.is_from_shop_stock
                                                                        ? s.badgeStock
                                                                        : s.badgeCustom
                                                                }
                                                            >
                                                                {it.is_from_shop_stock
                                                                    ? "Со склада"
                                                                    : "Под заказ"}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <button
                                    type="button"
                                    className={s.primaryBtnFull}
                                    onClick={() => handleOpenModal(o)}
                                    disabled={savingId === orderId}
                                >
                                    {savingId === orderId ? "Принимаем…" : "Принять заказ"}
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Пагинация */}
                {totalOrders > 0 && (
                    <div className={s.paginationRow}>
                        <div className={s.pageInfo}>
                            Показаны{" "}
                            <b>
                                {startIndex + 1}-{endIndex}
                            </b>{" "}
                            из <b>{totalOrders}</b> заказов
                        </div>
                        <div className={s.pageControls}>
                            <span className={s.pageSizeLabel}>На странице:</span>
                            <select
                                className={s.select}
                                value={pageSize}
                                onChange={(e) => {
                                    const next = Number(e.target.value) || 10;
                                    setPageSize(next);
                                    setPage(1);
                                }}
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                            </select>

                            <button
                                type="button"
                                className={s.pageBtn}
                                onClick={handlePrev}
                                disabled={page <= 1}
                            >
                                Назад
                            </button>
                            <span className={s.pageIndicator}>
                                {page}/{totalPages}
                            </span>
                            <button
                                type="button"
                                className={s.pageBtn}
                                onClick={handleNext}
                                disabled={page >= totalPages}
                            >
                                Вперёд
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Модальное окно принятия заказа */}
            {showModal && selectedOrder && (
                <div className={s.modalOverlay}>
                    <div className={s.modal}>
                        <div className={s.modalHeader}>
                            <h2>Принять заказ {selectedOrder.id}</h2>
                            <button
                                type="button"
                                className={s.modalClose}
                                onClick={handleCloseModal}
                            >
                                ×
                            </button>
                        </div>

                        <div className={s.modalBody}>
                            <div className={s.modalInfo}>
                                <p><strong>Клиент:</strong> {selectedOrder.customer_name || "—"} ({selectedOrder.customer_phone || "—"})</p>
                                <p><strong>Адрес:</strong> {formatAddress(selectedOrder)}</p>
                                {selectedOrder.delivery_type === "pickup" && selectedOrder.shop && (
                                    <p><strong>Магазин:</strong> {selectedOrder.shop.name || `${selectedOrder.shop.id}`} ({selectedOrder.shop.city}, {selectedOrder.shop.street})</p>
                                )}
                                <p><strong>Тип доставки:</strong> {formatDeliveryType(selectedOrder.delivery_type)}</p>
                                <p><strong>Сумма:</strong> {money(selectedOrder.total_amount)} BYN</p>
                            </div>

                            <div className={s.formGroup}>
                                <label htmlFor="routeHint" className={s.formLabel}>
                                    Маршрутная подсказка
                                </label>
                                <textarea
                                    id="routeHint"
                                    className={s.textarea}
                                    value={routeHint}
                                    onChange={(e) => setRouteHint(e.target.value)}
                                    placeholder={
                                        selectedOrder.delivery_type === "pickup" 
                                            ? "Например: Минск-Брест-Гомель" 
                                            : "Например: Минск-Брест-Гомель"
                                    }
                                    rows={2}
                                />
                            </div>

                            <div className={s.formGroup}>
                                <label htmlFor="comment" className={s.formLabel}>
                                    Комментарии водителя (необязательно)
                                </label>
                                <textarea
                                    id="comment"
                                    className={s.textarea}
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder="Дополнительная информация по доставке"
                                    rows={3}
                                />
                            </div>
                        </div>

                        <div className={s.modalFooter}>
                            <button
                                type="button"
                                className={s.secondaryBtn}
                                onClick={handleCloseModal}
                                disabled={!!savingId}
                            >
                                Отмена
                            </button>
                            <button
                                type="button"
                                className={s.primaryBtn}
                                onClick={takeOrder}
                                disabled={!!savingId}
                            >
                                {savingId ? "Принимаем…" : "Принять заказ"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}