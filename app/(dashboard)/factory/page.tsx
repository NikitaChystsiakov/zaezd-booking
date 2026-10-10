// app/(factory)/factory/page.tsx
"use client";

import { Fragment, useEffect, useState } from "react";
import { useToast } from "@/hooks/useToast";
import s from "./FactoryOrders.module.css";

type Shop = {
  id: number | string;
  city: string;
  street: string;
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

type FactoryOrder = {
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
  shop?: Shop | null;
  factory_worker_id?: number | string | null;
  items?: OrderItem[];
};

type ApiResponse = {
  available: FactoryOrder[];
  mine: FactoryOrder[];
  message?: string;
};

const money = (v: any) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2);
};

const formatStatus = (s: string) => {
  switch (s) {
    case "created":
      return "Создан";
    case "in_production":
      return "В производстве";
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

export default function FactoryOrdersPage() {
  const toast = useToast();

  const [available, setAvailable] = useState<FactoryOrder[]>([]);
  const [mine, setMine] = useState<FactoryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | number | null>(null);
  const [tab, setTab] = useState<"available" | "mine">("available");
  const [openOrders, setOpenOrders] = useState<Record<string, boolean>>({});

  // пагинация
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  async function load() {
    try {
      setErr(null);
      setLoading(true);

      const res = await fetch("/api/v1/factory/orders", {
        credentials: "include",
      });
      const json: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.message || "Ошибка загрузки заказов");
      }

      setAvailable(Array.isArray(json.available) ? json.available : []);
      setMine(Array.isArray(json.mine) ? json.mine : []);
      setPage(1); // на любую новую загрузку — первая страница
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

  // при смене вкладки возвращаемся на первую страницу
  useEffect(() => {
    setPage(1);
  }, [tab]);

  const list = tab === "available" ? available : mine;
  const totalCurrent = list.length;
  const totalPages =
    totalCurrent === 0 ? 1 : Math.ceil(totalCurrent / pageSize);

  const startIndex = totalCurrent === 0 ? 0 : (page - 1) * pageSize;
  const endIndex =
    totalCurrent === 0 ? 0 : Math.min(startIndex + pageSize, totalCurrent);
  const pagedList = list.slice(startIndex, endIndex);

  async function doAction(
    orderId: number | string,
    action: "take" | "mark_ready"
  ) {
    try {
      setSavingId(orderId);
      const res = await fetch("/api/v1/factory/orders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: Number(orderId), action }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Ошибка обновления заказа");

      toast.show({
        title:
          action === "take"
            ? "Заказ взят в производство"
            : "Заказ отмечен как готов к отгрузке",
        description: `Заказ ${orderId}`,
      });

      await load();
    } catch (e: any) {
      toast.show({
        title: "Ошибка",
        description: e?.message ?? "Не удалось обновить заказ",
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

  const totalAvailable = available.length;
  const totalMine = mine.length;

  return (
    <section className={s.wrapper}>
      <div className={s.card}>
        <div className={s.headerRow}>
          <h1 className={s.title}>Заказы производства</h1>
          <div className={s.headerActions}>
            <span className={s.muted}>
              Новые: <b>{totalAvailable}</b>  Мои: <b>{totalMine}</b>
            </span>
          </div>
        </div>

        {/* Табы */}
        <div className={s.tabs}>
          <button
            type="button"
            className={`${s.tabBtn} ${
              tab === "available" ? s.tabBtnActive : ""
            }`}
            onClick={() => setTab("available")}
          >
            Новые
          </button>
          <button
            type="button"
            className={`${s.tabBtn} ${
              tab === "mine" ? s.tabBtnActive : ""
            }`}
            onClick={() => setTab("mine")}
          >
            Мои в производстве
          </button>
        </div>

        {/* Десктоп / планшет — таблица */}
        <div className={s.tableContainer}>
          <div className={s.tableWrapper}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Дата</th>
                  <th>Клиент</th>
                  <th>Магазин</th>
                  <th>Доставка</th>
                  <th>Статус</th>
                  <th>Сумма</th>
                  <th>Товары</th>
                  <th className={s.actionsCell}>Действие</th>
                </tr>
              </thead>
              <tbody>
                {totalCurrent === 0 && (
                  <tr>
                    <td colSpan={9} className={s.placeholder}>
                      В этой вкладке нет заказов.
                    </td>
                  </tr>
                )}

                {pagedList.map((o) => {
                  const orderId = String(o.id);
                  const isOpen = !!openOrders[orderId];
                  const items = Array.isArray(o.items) ? o.items : [];

                  let actionLabel: string | null = null;
                  let actionType: "take" | "mark_ready" | null = null;

                  if (tab === "available" && o.status === "created") {
                    actionLabel = "Взять в производство";
                    actionType = "take";
                  } else if (tab === "mine" && o.status === "in_production") {
                    actionLabel = "Готов к отгрузке";
                    actionType = "mark_ready";
                  }

                  return (
                    <Fragment key={orderId}>
                      <tr>
                        <td>{orderId}</td>
                        <td>
                          {new Date(o.created_at).toLocaleString("ru-RU")}
                        </td>
                        <td>{o.customer_name || "—"}</td>
                        <td>
                          {o.shop
                            ? `${o.shop.id}  ${o.shop.city}, ${o.shop.street}`
                            : "—"}
                        </td>
                        <td>{formatDeliveryType(o.delivery_type)}</td>
                        <td>
                          <span
                            className={`${s.statusBadge} ${
                              o.status === "created"
                                ? s.statusCreated
                                : o.status === "in_production"
                                ? s.statusInProd
                                : o.status === "ready_to_ship"
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
                                ? "Скрыть"
                                : `Показать`}
                            </button>
                          )}
                        </td>
                        <td className={s.actionsCell}>
                          {actionLabel && actionType ? (
                            <button
                              type="button"
                              className={s.primaryBtn}
                              disabled={savingId === orderId}
                              onClick={() => doAction(orderId, actionType)}
                            >
                              {savingId === orderId
                                ? "Обновляем…"
                                : actionLabel}
                            </button>
                          ) : (
                            <span className={s.muted}>—</span>
                          )}
                        </td>
                      </tr>

                      {isOpen && items.length > 0 && (
                        <tr key={`${orderId}-items`}>
                          <td colSpan={9} className={s.itemsCell}>
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
                                          {material}
                                        </span>
                                      )}
                                    </div>
                                    <div className={s.itemMeta}>
                                      <span>
                                        SKU: <b>{sku}</b>
                                      </span>
                                      <span>
                                        Кол-во: <b>{it.quantity}</b>
                                      </span>
                                      <span>
                                        Цена:{" "}
                                        <b>{money(pv?.price)} BYN</b>
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
          {totalCurrent === 0 && (
            <div className={s.placeholder}>
              В этой вкладке нет заказов.
            </div>
          )}

          {pagedList.map((o) => {
            const orderId = String(o.id);
            const items = Array.isArray(o.items) ? o.items : [];

            let actionLabel: string | null = null;
            let actionType: "take" | "mark_ready" | null = null;

            if (tab === "available" && o.status === "created") {
              actionLabel = "Взять в производство";
              actionType = "take";
            } else if (tab === "mine" && o.status === "in_production") {
              actionLabel = "Готов к отгрузке";
              actionType = "mark_ready";
            }

            return (
              <div key={orderId} className={s.orderCard}>
                <div className={s.orderHeader}>
                  <div className={s.orderTitle}>Заказ {orderId}</div>
                  <div className={s.orderStatusRow}>
                    <span className={s.orderMeta}>
                      {new Date(o.created_at).toLocaleString("ru-RU")}
                    </span>
                    <span
                      className={`${s.statusBadge} ${
                        o.status === "created"
                          ? s.statusCreated
                          : o.status === "in_production"
                          ? s.statusInProd
                          : o.status === "ready_to_ship"
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
                    Клиент: {o.customer_name || "—"} {" "}
                    {o.customer_phone || "—"}
                  </div>
                  <div className={s.orderMeta}>
                    Магазин:{" "}
                    {o.shop
                      ? `${o.shop.id} ${o.shop.city}, ${o.shop.street}`
                      : "—"}
                  </div>
                  <div className={s.orderMeta}>
                    Доставка: {formatDeliveryType(o.delivery_type)}
                  </div>
                  <div className={s.orderMeta}>
                    Сумма: <b>{money(o.total_amount)} BYN</b>
                  </div>
                </div>

                {items.length > 0 && (
                  <div className={s.itemsBlock}>
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
                            SKU: {sku}  Количество: {it.quantity} Цена:{" "}
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

                {actionLabel && actionType && (
                  <button
                    type="button"
                    className={s.primaryBtnFull}
                    disabled={savingId === orderId}
                    onClick={() => doAction(orderId, actionType)}
                  >
                    {savingId === orderId ? "Обновляем…" : actionLabel}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Пагинация общая для вкладки */}
        {totalCurrent > 0 && (
          <div className={s.paginationRow}>
            <div className={s.pageInfo}>
              Показаны{" "}
              <b>
                {startIndex + 1}-{endIndex}
              </b>{" "}
              из <b>{totalCurrent}</b> заказов
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
    </section>
  );
}
