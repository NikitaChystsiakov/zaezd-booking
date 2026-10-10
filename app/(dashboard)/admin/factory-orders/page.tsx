"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/useToast";
import s from "./AdminFactoryOrders.module.css";
import Link from "next/link";
import React from "react";

type Shop = {
  id: number;
  city: string;
  street: string;
};

type Worker = {
  id: number;
  email: string | null;
  first_name: string | null;
  second_name: string | null;
  last_name: string | null;
  phone: string | null;
};

type ProductVariantBrief = {
  id: number;
  sku: string | null;
  price: number | string | null;
  product: { name: string | null } | null;
  material: { name: string | null } | null;
};

type OrderItem = {
  id: number;
  quantity: number;
  is_from_shop_stock: boolean;
  productVariant: ProductVariantBrief | null;
};

type OrderStatusString =
  | "created"
  | "in_production"
  | "ready_to_ship"
  | "in_transit"
  | "delivered"
  | "cancelled"
  | string;

type FactoryOrder = {
  id: number;
  created_at: string;
  status: OrderStatusString;
  delivery_type: string;
  customer_name: string | null;
  customer_phone: string | null;
  total_amount: number | string;
  shop: Shop | null;
  factory_worker_id: number | null;
  worker: Worker | null;
  items: OrderItem[];
};

type ApiResponse = {
  orders: FactoryOrder[];
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
      return "Подготовлен";
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

const makeFullName = (w: Worker | null) => {
  if (!w) return "—";
  const parts = [w.last_name, w.first_name, w.second_name].filter(Boolean);
  return parts.length ? parts.join(" ") : "Без имени";
};

export default function AdminFactoryOrdersPage() {
  const toast = useToast();

  const [orders, setOrders] = useState<FactoryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [openOrders, setOpenOrders] = useState<Record<number, boolean>>({});
  const [statusFilter, setStatusFilter] = useState<
    "all" | "in_production" | "ready_to_ship" | "delivered"
  >("all");

  // пагинация
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  async function load() {
    try {
      setErr(null);
      setLoading(true);
      setIsRefreshing(true);

      const res = await fetch("/api/v1/admin/factory-orders", {
        credentials: "include",
      });
      const json: ApiResponse = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Ошибка загрузки заказов");
      }

      setOrders(Array.isArray(json.orders) ? json.orders : []);
      setPage(1); // сбрасываем на первую страницу при новой загрузке
    } catch (e: any) {
      const msg = e?.message ?? "Ошибка загрузки заказов";
      setErr(msg);
      toast.show({ title: "Ошибка", description: msg });
    } finally {
      setLoading(false);
      setTimeout(() => setIsRefreshing(false), 250);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const filteredOrders = useMemo(
    () =>
      orders.filter((o) =>
        statusFilter === "all" ? true : o.status === statusFilter
      ),
    [orders, statusFilter]
  );

  const totalFiltered = filteredOrders.length;
  const totalPages =
    totalFiltered === 0 ? 1 : Math.ceil(totalFiltered / pageSize);

  const startIndex = totalFiltered === 0 ? 0 : (page - 1) * pageSize;
  const endIndex =
    totalFiltered === 0
      ? 0
      : Math.min(startIndex + pageSize, totalFiltered);

  const pagedOrders = useMemo(
    () => filteredOrders.slice(startIndex, endIndex),
    [filteredOrders, startIndex, endIndex]
  );

  const statInProd = orders.filter((o) => o.status === "in_production").length;
  const statReady = orders.filter((o) => o.status === "ready_to_ship").length;
  const statDelivered = orders.filter((o) => o.status === "delivered").length;

  const toggleOpen = (id: number) => {
    setOpenOrders((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
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
          <h1 className={s.title}>Производственные заказы</h1>
          <div className={s.headerActions}>
            <span className={s.muted}>
              Всего: <b>{orders.length}</b>  В производстве:{" "}
              <b>{statInProd}</b>  Готовы: <b>{statReady}</b>  Доставлены:{" "}
              <b>{statDelivered}</b>
            </span>
          </div>
        </div>

        {/* Фильтры + обновить */}
        <div className={s.filtersRow}>
          <div className={s.filterGroup}>
            <span className={s.filterLabel}>Статус:</span>
            <select
              className={s.select}
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as typeof statusFilter)
              }
            >
              <option value="all">Все</option>
              <option value="in_production">В производстве</option>
              <option value="ready_to_ship">Готов к отгрузке</option>
              <option value="delivered">Доставлен</option>
            </select>
          </div>
          <div className={s.buttonGroup}>
            <Link className={s.secondaryBtn} href="/admin">
              ← Назад
            </Link>
            <button
              type="button"
              className={s.secondaryBtn}
              onClick={load}
              disabled={isRefreshing}
            >
              {isRefreshing ? "Обновляем…" : "Обновить"}
            </button>
          </div>
        </div>

        {/* Десктопная таблица */}
        <div className={s.tableContainer}>
          <div
            className={`${s.tableWrapper} ${isRefreshing ? s.tableFading : ""
              }`}
          >
            <table className={s.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Дата</th>
                  <th>Работник цеха</th>
                  <th>Магазин</th>
                  <th>Доставка</th>
                  <th>Статус</th>
                  <th>Сумма</th>
                  <th>Позиции</th>
                </tr>
              </thead>
              <tbody>
                {pagedOrders.length === 0 && (
                  <tr>
                    <td colSpan={8} className={s.placeholder}>
                      Для выбранного фильтра нет заказов.
                    </td>
                  </tr>
                )}

                {pagedOrders.map((o) => {
                  const id = Number(o.id);
                  const workerName = makeFullName(o.worker);
                  const workerPhone = o.worker?.phone || "—";
                  const items = Array.isArray(o.items) ? o.items : [];
                  const isOpen = !!openOrders[id];

                  return (
                    <React.Fragment key={id}>
                      <tr key={id}>
                        <td>{id}</td>
                        <td>
                          {new Date(o.created_at).toLocaleString("ru-RU")}
                        </td>
                        <td>
                          <div>{workerName}</div>
                          <div className={s.muted}>Тел: {workerPhone}</div>
                        </td>
                        <td>
                          {o.shop
                            ? `${o.shop.id} ${o.shop.city}, ${o.shop.street}`
                            : "—"}
                        </td>
                        <td>{formatDeliveryType(o.delivery_type)}</td>
                        <td>
                          <span
                            className={`${s.statusBadge} ${o.status === "in_production"
                              ? s.statusInProd
                              : o.status === "ready_to_ship"
                                ? s.statusReady
                                : o.status === "delivered"
                                  ? s.statusDelivered
                                  : s.statusOther
                              }`}
                          >
                            {formatStatus(o.status)}
                          </span>
                        </td>
                        <td>{money(o.total_amount)} BYN</td>
                        <td className={s.actionsCell}>
                          {items.length === 0 ? (
                            <span className={s.muted}>—</span>
                          ) : (
                            <button
                              type="button"
                              className={s.secondaryBtn}
                              onClick={() => toggleOpen(id)}
                            >
                              {isOpen
                                ? "Скрыть позиции"
                                : `Показать `}
                            </button>
                          )}
                        </td>
                      </tr>

                      {isOpen && items.length > 0 && (
                        <tr key={`${id}-items`}>
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
                                  <div key={it.id} className={s.itemRow}>
                                    <div className={s.itemTitle}>
                                      {name || "Без названия"}
                                      {material && (
                                        <span className={s.muted}>
                                          {material}
                                        </span>
                                      )}
                                    </div>
                                    <div className={s.itemMeta}>
                                      <span>SKU: {sku}</span>
                                      <span>Количество: {it.quantity}</span>
                                      <span>
                                        Цена: {money(pv?.price)} BYN
                                      </span>

                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Мобильные карточки */}
        <div className={s.mobileList}>
          {pagedOrders.length === 0 && (
            <div className={s.placeholder}>
              Для выбранного фильтра нет заказов.
            </div>
          )}

          {pagedOrders.map((o) => {
            const id = Number(o.id);
            const workerName = makeFullName(o.worker);
            const workerPhone = o.worker?.phone || "—";
            const items = Array.isArray(o.items) ? o.items : [];

            return (
              <div key={id} className={s.orderCard}>
                <div className={s.orderHeader}>
                  <div className={s.orderTitle}>Заказ {id}</div>
                  <div className={s.orderStatusRow}>
                    <span className={s.orderMeta}>
                      {new Date(o.created_at).toLocaleString("ru-RU")}
                    </span>
                    <span
                      className={`${s.statusBadge} ${o.status === "in_production"
                        ? s.statusInProd
                        : o.status === "ready_to_ship"
                          ? s.statusReady
                          : o.status === "delivered"
                            ? s.statusDelivered
                            : s.statusOther
                        }`}
                    >
                      {formatStatus(o.status)}
                    </span>
                  </div>
                </div>

                <div className={s.orderBody}>
                  <div className={s.orderMeta}>
                    Работник: {workerName} Тел: {workerPhone}
                  </div>
                  <div className={s.orderMeta}>
                    Магазин:{" "}
                    {o.shop
                      ? `${o.shop.id}  ${o.shop.city}, ${o.shop.street}`
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
                        ? ` ${pv.material.name}`
                        : "";
                      const sku = pv?.sku ?? "—";

                      return (
                        <div key={it.id} className={s.itemPill}>
                          <div className={s.itemPillTitle}>
                            {name || "Без названия"}
                            {material && (
                              <span className={s.muted}>{material}</span>
                            )}
                          </div>
                          <div className={s.itemPillMeta}>
                            SKU: {sku}  Количество: {it.quantity}  Цена:{" "}
                            {money(pv?.price)} BYN
                          </div>
                          <div
                            className={
                              it.is_from_shop_stock
                                ? s.badgeStock
                                : s.badgeCustom
                            }
                          >
                            {it.is_from_shop_stock ? "Со склада" : "Под заказ"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Пагинация (общая для десктопа и мобилы) */}
        {totalFiltered > 0 && (
          <div className={s.paginationRow}>
            <div className={s.pageInfo}>
              Показаны{" "}
              <b>
                {startIndex + 1}-{endIndex}
              </b>{" "}
              из <b>{totalFiltered}</b> заказов
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
    </section >
  );
}
