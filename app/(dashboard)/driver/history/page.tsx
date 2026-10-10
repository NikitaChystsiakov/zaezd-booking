"use client";

import { Fragment, useEffect, useState } from "react";
import { useToast } from "@/hooks/useToast";
import s from "./DriverHistory.module.css";

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

type Order = {
  id: number | string;
  created_at: string;
  status: "delivered" | "cancelled" | "in_transit" | string;
  delivery_type: string;
  customer_name: string | null;
  customer_phone: string | null;
  total_amount: number | string;
  address: Address | null;
  shop: Shop | null; // Добавляем магазин
  items: OrderItem[];
  driver_id: number | string | null;
};

type ShipmentOrder = {
  id: number | string;
  shipment_id: number | string;
  order_id: number | string;
  order: Order;
};

type Shipment = {
  id: number | string;
  driver_id: number | string;
  planned_at: string;
  status: "delivered" | "cancelled" | "in_transit" | string;
  route_hint: string | null;
  started_at: string;
  finished_at: string | null;
  comment: string | null;
  orders: ShipmentOrder[];
};

type ApiResponse = {
  shipments: Shipment[];
  message?: string;
};

const money = (v: any) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2);
};

const formatStatus = (s: string) => {
  switch (s) {
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

const formatDateTime = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatTime = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatAddress = (order: Order) => {
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

const getAddressComment = (order: Order) => {
  if (order.delivery_type === "home_delivery" && order.address?.comment) {
    return order.address.comment;
  }
  return null;
};

type FilterStatus = "all" | "delivered" | "cancelled";

export default function DriverHistoryPage() {
  const toast = useToast();

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [openShipments, setOpenShipments] = useState<Record<string, boolean>>({});
  const [openOrders, setOpenOrders] = useState<Record<string, boolean>>({});
  
  // Фильтры
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  
  // пагинация
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  async function load() {
    try {
      setErr(null);
      setLoading(true);

      // Создаем query параметры для фильтров
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      if (dateFrom) {
        params.append("from", dateFrom);
      }
      if (dateTo) {
        params.append("to", dateTo);
      }

      const url = `/api/v1/driver/history${params.toString() ? `?${params.toString()}` : ''}`;
      
      const res = await fetch(url, {
        credentials: "include",
      });

      // Проверяем, что это JSON
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Non-JSON response:", text.substring(0, 200));
        throw new Error(`Server returned ${res.status}: ${text.substring(0, 100)}...`);
      }

      const json: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.message || `Ошибка ${res.status}: ${res.statusText}`);
      }

      setShipments(Array.isArray(json.shipments) ? json.shipments : []);
      setPage(1);
    } catch (e: any) {
      const msg = e?.message ?? "Ошибка загрузки истории доставок";
      setErr(msg);
      toast.show({ 
        title: "Ошибка", 
        description: msg,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Применяем фильтры
  const filteredShipments = shipments.filter(shipment => {
    if (statusFilter !== "all" && shipment.status !== statusFilter) {
      return false;
    }
    
    if (dateFrom) {
      const shipmentDate = new Date(shipment.finished_at || shipment.started_at);
      const fromDate = new Date(dateFrom);
      if (shipmentDate < fromDate) return false;
    }
    
    if (dateTo) {
      const shipmentDate = new Date(shipment.finished_at || shipment.started_at);
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999); // Конец дня
      if (shipmentDate > toDate) return false;
    }
    
    return true;
  });

  const totalShipments = filteredShipments.length;
  const totalPages = totalShipments === 0 ? 1 : Math.ceil(totalShipments / pageSize);

  const startIndex = totalShipments === 0 ? 0 : (page - 1) * pageSize;
  const endIndex = totalShipments === 0 ? 0 : Math.min(startIndex + pageSize, totalShipments);
  const pagedShipments = filteredShipments.slice(startIndex, endIndex);

  const toggleOpenShipment = (shipmentId: number | string) => {
    setOpenShipments((prev) => {
      const id = String(shipmentId);
      return { ...prev, [id]: !prev[id] };
    });
  };

  const toggleOpenOrder = (orderId: number | string) => {
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

  const handleApplyFilters = () => {
    setPage(1);
  };

  const handleResetFilters = () => {
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  // Статистика
  const deliveredCount = shipments.filter(s => s.status === "delivered").length;
  const cancelledCount = shipments.filter(s => s.status === "cancelled").length;
  const totalAmount = shipments.reduce((sum, shipment) => {
    const orderTotal = shipment.orders.reduce((orderSum, shipmentOrder) => {
      return orderSum + Number(shipmentOrder.order.total_amount || 0);
    }, 0);
    return sum + orderTotal;
  }, 0);

  if (loading) {
    return (
      <section className={s.wrapper}>
        <div className={s.card}>
          <p className={s.muted}>Загрузка истории доставок…</p>
        </div>
      </section>
    );
  }

  if (err) {
    return (
      <section className={s.wrapper}>
        <div className={s.card}>
          <div className={s.headerRow}>
            <h1 className={s.title}>История доставок</h1>
            <button
              type="button"
              className={s.secondaryBtn}
              onClick={load}
            >
              Обновить
            </button>
          </div>
          <p className={s.error}>Ошибка: {err}</p>
          <button
            type="button"
            className={s.primaryBtn}
            onClick={load}
          >
            Попробовать снова
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={s.wrapper}>
      <div className={s.card}>
        <div className={s.headerRow}>
          <h1 className={s.title}>История доставок</h1>
          <div className={s.headerActions}>
            <button
              type="button"
              className={s.refreshBtn}
              onClick={load}
              disabled={loading}
            >
              Обновить
            </button>
            <span className={s.muted}>
              Всего доставок: <b>{shipments.length}</b>
            </span>
          </div>
        </div>

        {/* Статистика */}
        <div className={s.statsRow}>
          <div className={s.statCard}>
            <div className={s.statLabel}>Всего доставок</div>
            <div className={s.statValue}>{shipments.length}</div>
          </div>
          <div className={s.statCard}>
            <div className={s.statLabel}>Доставлено</div>
            <div className={`${s.statValue} ${s.statDelivered}`}>
              {deliveredCount}
            </div>
          </div>
          <div className={s.statCard}>
            <div className={s.statLabel}>Отменено</div>
            <div className={`${s.statValue} ${s.statCancelled}`}>
              {cancelledCount}
            </div>
          </div>
          <div className={s.statCard}>
            <div className={s.statLabel}>Общая сумма</div>
            <div className={s.statValue}>{money(totalAmount)} BYN</div>
          </div>
        </div>

        {/* Фильтры */}
        <div className={s.filtersCard}>
          <div className={s.filtersHeader}>
            <h3 className={s.filtersTitle}>Фильтры</h3>
            <button
              type="button"
              className={s.secondaryBtn}
              onClick={handleResetFilters}
            >
              Сбросить
            </button>
          </div>
          
          <div className={s.filtersGrid}>
            <div className={s.filterGroup}>
              <label className={s.filterLabel}>Статус:</label>
              <select
                className={s.filterSelect}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
              >
                <option value="all">Все статусы</option>
                <option value="delivered">Доставленные</option>
                <option value="cancelled">Отменённые</option>
              </select>
            </div>
            
            <div className={s.filterGroup}>
              <label className={s.filterLabel}>С:</label>
              <input
                type="date"
                className={s.filterInput}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            
            <div className={s.filterGroup}>
              <label className={s.filterLabel}>По:</label>
              <input
                type="date"
                className={s.filterInput}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            
            <div className={s.filterGroup}>
              <button
                type="button"
                className={s.primaryBtn}
                onClick={handleApplyFilters}
              >
                Применить фильтры
              </button>
            </div>
          </div>
        </div>

        {/* Десктоп / планшет — таблица */}
        <div className={s.tableContainer}>
          <div className={s.tableWrapper}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Завершено</th>
                  <th>Статус</th>
                  <th>Заказов</th>
                  <th>Сумма</th>
                  <th>Маршрут</th>
                  <th>Комментарий</th>
                  <th className={s.actionsCell}>Детали</th>
                </tr>
              </thead>
              <tbody>
                {totalShipments === 0 && (
                  <tr>
                    <td colSpan={8} className={s.placeholder}>
                      {shipments.length === 0 
                        ? "У вас ещё нет завершённых доставок." 
                        : "Нет доставок по выбранным фильтрам."}
                    </td>
                  </tr>
                )}

                {pagedShipments.map((shipment) => {
                  const shipmentId = String(shipment.id);
                  const isShipmentOpen = !!openShipments[shipmentId];
                  const orders = Array.isArray(shipment.orders) ? shipment.orders : [];
                  
                  // Сумма всех заказов в доставке
                  const shipmentAmount = orders.reduce((sum, shipmentOrder) => {
                    return sum + Number(shipmentOrder.order.total_amount || 0);
                  }, 0);

                  return (
                    <Fragment key={shipmentId}>
                      <tr>
                        <td>
                          <span className={s.shipmentId}>{shipmentId}</span>
                        </td>
                        <td>
                          {shipment.finished_at ? (
                            <>
                              <div>{formatDate(shipment.finished_at)}</div>
                              <div className={s.time}>{formatTime(shipment.finished_at)}</div>
                            </>
                          ) : (
                            <span className={s.muted}>—</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`${s.statusBadge} ${
                              shipment.status === "delivered"
                                ? s.statusDelivered
                                : s.statusCancelled
                            }`}
                          >
                            {formatStatus(shipment.status)}
                          </span>
                        </td>
                        <td>
                          {orders.length === 0 ? (
                            <span className={s.muted}>—</span>
                          ) : (
                            <button
                              type="button"
                              className={s.secondaryBtn}
                              onClick={() => toggleOpenShipment(shipmentId)}
                            >
                              {isShipmentOpen
                                ? "Скрыть"
                                : `${orders.length} зак.`}
                            </button>
                          )}
                        </td>
                        <td className={s.amountCell}>
                          <b>{money(shipmentAmount)} BYN</b>
                        </td>
                        <td>
                          {shipment.route_hint ? (
                            <div className={s.routeHint}>
                              {shipment.route_hint.length > 30
                                ? `${shipment.route_hint.substring(0, 30)}…`
                                : shipment.route_hint}
                            </div>
                          ) : (
                            <span className={s.muted}>—</span>
                          )}
                        </td>
                        <td>
                          {shipment.comment ? (
                            <div className={s.comment}>
                              {shipment.comment.length > 30
                                ? `${shipment.comment.substring(0, 30)}…`
                                : shipment.comment}
                            </div>
                          ) : (
                            <span className={s.muted}>—</span>
                          )}
                        </td>
                        <td className={s.actionsCell}>
                          <button
                            type="button"
                            className={s.secondaryBtn}
                            onClick={() => toggleOpenShipment(shipmentId)}
                          >
                            {isShipmentOpen ? "Свернуть" : "Развернуть"}
                          </button>
                        </td>
                      </tr>

                      {isShipmentOpen && orders.length > 0 && (
                        <tr key={`${shipmentId}-orders`}>
                          <td colSpan={8} className={s.ordersCell}>
                            <div className={s.ordersList}>
                              <div className={s.ordersHeader}>
                                <h4>Заказы в доставке {shipmentId}</h4>
                                <div className={s.shipmentMeta}>
                                  <span>Начало: {formatDateTime(shipment.started_at)}</span>
                                  {shipment.finished_at && (
                                    <span>Завершение: {formatDateTime(shipment.finished_at)}</span>
                                  )}
                                  {shipment.route_hint && (
                                    <span>Маршрут: {shipment.route_hint}</span>
                                  )}
                                  {shipment.comment && (
                                    <span>Комментарий: {shipment.comment}</span>
                                  )}
                                </div>
                              </div>
                              
                              {orders.map((shipmentOrder) => {
                                const order = shipmentOrder.order;
                                const orderId = String(order.id);
                                const isOrderOpen = !!openOrders[orderId];
                                const items = Array.isArray(order.items) ? order.items : [];
                                const addressComment = getAddressComment(order);

                                return (
                                  <div key={orderId} className={s.orderCard}>
                                    <div className={s.orderHeader}>
                                      <div className={s.orderTitleRow}>
                                        <h3 className={s.orderTitle}>
                                          Заказ {orderId}
                                          <span className={s.orderStatus}>
                                            {formatStatus(order.status)}
                                          </span>
                                          <span className={s.orderAmount}>
                                            {money(order.total_amount)} BYN
                                          </span>
                                        </h3>
                                        <button
                                          type="button"
                                          className={s.secondaryBtn}
                                          onClick={() => toggleOpenOrder(orderId)}
                                        >
                                          {isOrderOpen ? "Скрыть товары" : "Показать товары"}
                                        </button>
                                      </div>
                                      <div className={s.orderMeta}>
                                        <span>Клиент: {order.customer_name || "—"} {order.customer_phone || "—"}</span>
                                        <span>Создан: {formatDateTime(order.created_at)}</span>
                                        <span>Доставка: {formatDeliveryType(order.delivery_type)}</span>
                                        {order.delivery_type === "pickup" && order.shop && (
                                          <span>Магазин: {order.shop.name || `${order.shop.id}`}</span>
                                        )}
                                      </div>
                                      <div className={s.orderAddress}>
                                        <strong>Адрес:</strong> {formatAddress(order)}
                                        {addressComment && (
                                          <div className={s.addressComment}>
                                            {addressComment}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {isOrderOpen && items.length > 0 && (
                                      <div className={s.itemsList}>
                                        {items.map((item) => {
                                          const pv = item.productVariant;
                                          const name = pv?.product?.name ?? "";
                                          const material = pv?.material?.name
                                            ? ` ${pv.material.name}`
                                            : "";
                                          const sku = pv?.sku ?? "—";

                                          return (
                                            <div key={String(item.id)} className={s.itemRow}>
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
                                                  Количество: <b>{item.quantity}</b>
                                                </span>
                                                <span>
                                                  Цена: <b>{money(pv?.price)} BYN</b>
                                                </span>
                                                <span
                                                  className={
                                                    item.is_from_shop_stock
                                                      ? s.badgeStock
                                                      : s.badgeCustom
                                                  }
                                                >
                                                  {item.is_from_shop_stock
                                                    ? "Со склада"
                                                    : "Под заказ"}
                                                </span>
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
          {totalShipments === 0 && (
            <div className={s.placeholder}>
              {shipments.length === 0 
                ? "У вас ещё нет завершённых доставок." 
                : "Нет доставок по выбранным фильтрам."}
            </div>
          )}

          {pagedShipments.map((shipment) => {
            const shipmentId = String(shipment.id);
            const orders = Array.isArray(shipment.orders) ? shipment.orders : [];
            
            const shipmentAmount = orders.reduce((sum, shipmentOrder) => {
              return sum + Number(shipmentOrder.order.total_amount || 0);
            }, 0);

            return (
              <div key={shipmentId} className={s.shipmentCard}>
                <div className={s.shipmentHeader}>
                  <div className={s.shipmentTitle}>
                    Доставка {shipmentId}
                    <span
                      className={`${s.statusBadge} ${
                        shipment.status === "delivered"
                          ? s.statusDelivered
                          : s.statusCancelled
                      }`}
                    >
                      {formatStatus(shipment.status)}
                    </span>
                  </div>
                  <div className={s.shipmentMeta}>
                    <div>
                      <strong>Завершено:</strong> {shipment.finished_at 
                        ? formatDateTime(shipment.finished_at) 
                        : "—"}
                    </div>
                    <div>
                      <strong>Начало:</strong> {formatDateTime(shipment.started_at)}
                    </div>
                    <div>
                      <strong>Сумма:</strong> {money(shipmentAmount)} BYN
                    </div>
                    {shipment.route_hint && (
                      <div className={s.routeHint}>
                        <strong>Маршрут:</strong> {shipment.route_hint}
                      </div>
                    )}
                    {shipment.comment && (
                      <div className={s.comment}>
                        <strong>Комментарий:</strong> {shipment.comment}
                      </div>
                    )}
                  </div>
                </div>

                <div className={s.ordersBlock}>
                  <div className={s.ordersTitle}>
                    Заказы: <b>{orders.length}</b>
                  </div>
                  {orders.map((shipmentOrder) => {
                    const order = shipmentOrder.order;
                    const orderId = String(order.id);
                    const isOrderOpen = !!openOrders[orderId];
                    const items = Array.isArray(order.items) ? order.items : [];
                    const addressComment = getAddressComment(order);

                    return (
                      <div key={orderId} className={s.orderCardMobile}>
                        <div className={s.orderHeaderMobile}>
                          <div className={s.orderTitleMobile}>
                            Заказ {orderId}
                            <span className={s.orderStatusMobile}>
                              {formatStatus(order.status)}
                            </span>
                          </div>
                          <div className={s.orderMetaMobile}>
                            <div>Клиент: {order.customer_name || "—"}</div>
                            <div>Телефон: {order.customer_phone || "—"}</div>
                            <div>Доставка: {formatDeliveryType(order.delivery_type)}</div>
                            {order.delivery_type === "pickup" && order.shop && (
                              <div>Магазин: {order.shop.name || `${order.shop.id}`}</div>
                            )}
                            <div>Адрес: {formatAddress(order)}</div>
                            {addressComment && (
                              <div>Комментарий: {addressComment}</div>
                            )}
                            <div>Сумма: <b>{money(order.total_amount)} BYN</b></div>
                          </div>
                          <button
                            type="button"
                            className={s.secondaryBtn}
                            onClick={() => toggleOpenOrder(orderId)}
                          >
                            {isOrderOpen ? "Скрыть товары" : "Показать товары"}
                          </button>
                        </div>

                        {isOrderOpen && items.length > 0 && (
                          <div className={s.itemsListMobile}>
                            {items.map((item) => {
                              const pv = item.productVariant;
                              const name = pv?.product?.name ?? "";
                              const material = pv?.material?.name
                                ? `  ${pv.material.name}`
                                : "";
                              const sku = pv?.sku ?? "—";

                              return (
                                <div key={String(item.id)} className={s.itemPill}>
                                  <div className={s.itemPillTitle}>
                                    {name || "Без названия"}
                                    {material && (
                                      <span className={s.muted}>{material}</span>
                                    )}
                                  </div>
                                  <div className={s.itemPillMeta}>
                                    SKU: {sku} Количество: {item.quantity} Цена:{" "}
                                    {money(pv?.price)} BYN
                                  </div>
                                  <div
                                    className={
                                      item.is_from_shop_stock
                                        ? s.badgeStock
                                        : s.badgeCustom
                                    }
                                  >
                                    {item.is_from_shop_stock
                                      ? "Со склада"
                                      : "Под заказ"}
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
              </div>
            );
          })}
        </div>

        {/* Пагинация */}
        {totalShipments > 0 && (
          <div className={s.paginationRow}>
            <div className={s.pageInfo}>
              Показаны{" "}
              <b>
                {startIndex + 1}-{endIndex}
              </b>{" "}
              из <b>{totalShipments}</b> доставок
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