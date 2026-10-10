"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import { useToast } from "@/hooks/useToast";
import s from "./AdminShipments.module.css";

// Типы данных
type Shipment = {
  id: number | string;
  driver_id: number | string;
  driver: {
    id: number | string;
    first_name: string;
    second_name: string | null;
    last_name: string;
    phone: string;
    email: string;
  };
  planned_at: string;
  status: "planned" | "in_transit" | "delivered" | "cancelled";
  route_hint: string | null;
  started_at: string | null;
  finished_at: string | null;
  comment: string | null;
  orders: Array<{
    id: number | string;
    order: {
      id: number | string;
      created_at: string;
      status: string;
      delivery_type: string;
      customer_name: string | null;
      customer_phone: string | null;
      total_amount: number | string;
      address: {
        id: number | string;
        city: string;
        street: string;
        house_number: string | null;
        apartment: string | null;
        entrance: string | null;
        floor: string | null;
        comment: string | null;
      } | null;
      shop: {
        id: number | string;
        name: string | null;
        city: string;
        street: string;
        phone: string | null;
        email: string | null;
      } | null;
      items: Array<{
        id: number | string;
        quantity: number;
        is_from_shop_stock: boolean;
        productVariant: {
          id: number | string;
          sku: string | null;
          price: number | string | null;
          product?: { name: string | null } | null;
          material?: { name: string | null } | null;
        } | null;
      }>;
    };
  }>;
};

type ApiResponse = {
  shipments: Shipment[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  message?: string;
};

// Вспомогательные функции
const money = (v: any) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

const formatStatus = (s: string) => {
  switch (s) {
    case "planned":
      return "Запланирована";
    case "in_transit":
      return "В пути";
    case "delivered":
      return "Доставлена";
    case "cancelled":
      return "Отменена";
    default:
      return s;
  }
};

const formatDateTime = (dateStr: string | null) => {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatTime = (dateStr: string | null) => {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDriverName = (driver: any) => {
  if (!driver) return "—";
  return `${driver.last_name} ${driver.first_name}${driver.second_name ? ` ${driver.second_name}` : ''}`;
};

export default function AdminShipmentsPage() {
  const toast = useToast();
  
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openShipments, setOpenShipments] = useState<Record<string, boolean>>({});
  const [openOrders, setOpenOrders] = useState<Record<string, boolean>>({});
  
  // Состояние фильтров (внутреннее)
  const [filters, setFilters] = useState({
    status: "all",
    dateFrom: "",
    dateTo: "",
    driverId: "",
    searchQuery: "",
  });
  
  // Активные фильтры (примененные)
  const [activeFilters, setActiveFilters] = useState({
    status: "all",
    dateFrom: "",
    dateTo: "",
    driverId: "",
    searchQuery: "",
  });
  
  // Пагинация
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Функция загрузки данных
  const loadShipments = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      // Создаем query параметры из активных фильтров
      const params = new URLSearchParams();
      
      if (activeFilters.status && activeFilters.status !== "all") {
        params.append("status", activeFilters.status);
      }
      if (activeFilters.dateFrom) {
        params.append("from", activeFilters.dateFrom);
      }
      if (activeFilters.dateTo) {
        params.append("to", activeFilters.dateTo);
      }
      if (activeFilters.driverId.trim()) {
        params.append("driverId", activeFilters.driverId.trim());
      }
      if (activeFilters.searchQuery.trim()) {
        params.append("search", activeFilters.searchQuery.trim());
      }
      
      // Пагинация
      params.append("page", page.toString());
      params.append("limit", pageSize.toString());

      const url = `/api/v1/admin/shipments?${params.toString()}`;
      console.log("Loading shipments with filters:", {
        activeFilters,
        page,
        pageSize
      });
      
      const res = await fetch(url, {
        credentials: "include",
        headers: {
          'Cache-Control': 'no-cache',
        }
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Ошибка ${res.status}: ${res.statusText}`);
      }

      const json: ApiResponse = await res.json();

      setShipments(json.shipments || []);
      setTotal(json.total || 0);
      setPage(json.page || 1);
      setPageSize(json.limit || 10);
      setTotalPages(json.pages || Math.ceil((json.total || 0) / (json.limit || 1)));
      
    } catch (e: any) {
      console.error("Error loading shipments:", e);
      setError(e.message || "Ошибка загрузки данных");
      toast.show({ 
        title: "Ошибка", 
        description: e.message || "Не удалось загрузить данные",
      });
    } finally {
      setLoading(false);
    }
  }, [activeFilters, page, pageSize, toast]);

  // Загрузка при изменении активных фильтров или пагинации
  useEffect(() => {
    loadShipments();
  }, [loadShipments]);

  // Обработчики изменения фильтров
  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleApplyFilters = () => {
    // Применяем фильтры (копируем внутренние в активные)
    setActiveFilters(filters);
    setPage(1); // Сбрасываем на первую страницу
    setOpenShipments({}); // Закрываем все открытые доставки
    setOpenOrders({}); // Закрываем все открытые заказы
  };

  const handleResetFilters = () => {
    const resetFilters = {
      status: "all",
      dateFrom: "",
      dateTo: "",
      driverId: "",
      searchQuery: "",
    };
    
    setFilters(resetFilters);
    setActiveFilters(resetFilters);
    setPage(1);
    setOpenShipments({});
    setOpenOrders({});
  };

  const handleRefresh = () => {
    loadShipments();
  };

  const toggleOpenShipment = (shipmentId: number | string) => {
    setOpenShipments(prev => ({
      ...prev,
      [String(shipmentId)]: !prev[String(shipmentId)]
    }));
  };

  const toggleOpenOrder = (orderId: number | string) => {
    setOpenOrders(prev => ({
      ...prev,
      [String(orderId)]: !prev[String(orderId)]
    }));
  };

  const handlePrevPage = () => page > 1 && setPage(page - 1);
  const handleNextPage = () => page < totalPages && setPage(page + 1);
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  // Статистика
  const stats = {
    total: shipments.length,
    planned: shipments.filter(s => s.status === "planned").length,
    inTransit: shipments.filter(s => s.status === "in_transit").length,
    delivered: shipments.filter(s => s.status === "delivered").length,
    cancelled: shipments.filter(s => s.status === "cancelled").length,
    totalAmount: shipments.reduce((sum, shipment) => {
      return sum + shipment.orders.reduce((orderSum, item) => {
        return orderSum + Number(item.order.total_amount || 0);
      }, 0);
    }, 0),
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "planned": return s.statusPlanned;
      case "in_transit": return s.statusInTransit;
      case "delivered": return s.statusDelivered;
      case "cancelled": return s.statusCancelled;
      default: return "";
    }
  };

  if (loading && shipments.length === 0) {
    return (
      <section className={s.wrapper}>
        <div className={s.card}>
          <div className={s.loadingContainer}>
            <div className={s.spinner}></div>
            <p className={s.muted}>Загрузка доставок…</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={s.wrapper}>
      <div className={s.card}>
        <div className={s.headerRow}>
          <h1 className={s.title}>Доставки</h1>
          <div className={s.headerActions}>
            <button
              type="button"
              className={s.refreshBtn}
              onClick={handleRefresh}
              disabled={loading}
            >
              {loading ? "Загрузка..." : "Обновить"}
            </button>
            <span className={s.muted}>
              Всего: <b>{total}</b>
            </span>
          </div>
        </div>

        {/* Статистика */}
        <div className={s.statsRow}>
          <div className={s.statCard}>
            <div className={s.statLabel}>Всего доставок</div>
            <div className={s.statValue}>{total}</div>
          </div>
          <div className={s.statCard}>
            <div className={s.statLabel}>Запланировано</div>
            <div className={`${s.statValue} ${s.statPlanned}`}>
              {stats.planned}
            </div>
          </div>
          <div className={s.statCard}>
            <div className={s.statLabel}>В пути</div>
            <div className={`${s.statValue} ${s.statInTransit}`}>
              {stats.inTransit}
            </div>
          </div>
          <div className={s.statCard}>
            <div className={s.statLabel}>Доставлено</div>
            <div className={`${s.statValue} ${s.statDelivered}`}>
              {stats.delivered}
            </div>
          </div>
          <div className={s.statCard}>
            <div className={s.statLabel}>Отменено</div>
            <div className={`${s.statValue} ${s.statCancelled}`}>
              {stats.cancelled}
            </div>
          </div>
          <div className={s.statCard}>
            <div className={s.statLabel}>Общая сумма</div>
            <div className={s.statValue}>{money(stats.totalAmount)} BYN</div>
          </div>
        </div>

        {/* Фильтры */}
        <div className={s.filtersCard}>
          <div className={s.filtersHeader}>
            <h3 className={s.filtersTitle}>Фильтры и поиск</h3>
            <div className={s.filtersActions}>
              <button
                type="button"
                className={s.secondaryBtn}
                onClick={handleResetFilters}
                disabled={loading}
              >
                Сбросить
              </button>
              <button
                type="button"
                className={s.primaryBtn}
                onClick={handleApplyFilters}
                disabled={loading}
              >
                Применить фильтры
              </button>
            </div>
          </div>
          
          <div className={s.filtersGrid}>
            <div className={s.filterGroup}>
              <label className={s.filterLabel}>Статус:</label>
              <select
                className={s.filterSelect}
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                disabled={loading}
              >
                <option value="all">Все статусы</option>
                <option value="planned">Запланированные</option>
                <option value="in_transit">В пути</option>
                <option value="delivered">Доставленные</option>
                <option value="cancelled">Отменённые</option>
              </select>
            </div>
            
            <div className={s.filterGroup}>
              <label className={s.filterLabel}>Дата завершения с:</label>
              <input
                type="date"
                className={s.filterInput}
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                disabled={loading}
              />
            </div>
            
            <div className={s.filterGroup}>
              <label className={s.filterLabel}>Дата завершения по:</label>
              <input
                type="date"
                className={s.filterInput}
                value={filters.dateTo}
                onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                disabled={loading}
              />
            </div>
            
            <div className={s.filterGroup}>
              <label className={s.filterLabel}>ID водителя:</label>
              <input
                type="number"
                className={s.filterInput}
                placeholder="ID водителя"
                value={filters.driverId}
                onChange={(e) => handleFilterChange("driverId", e.target.value)}
                disabled={loading}
              />
            </div>
            
            <div className={s.filterGroup}>
              <label className={s.filterLabel}>Поиск по ID:</label>
              <input
                type="text"
                className={s.filterInput}
                placeholder="ID доставки или заказа"
                value={filters.searchQuery}
                onChange={(e) => handleFilterChange("searchQuery", e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {/* Показать активные фильтры */}
          {(activeFilters.status !== "all" || 
            activeFilters.dateFrom || 
            activeFilters.dateTo || 
            activeFilters.driverId || 
            activeFilters.searchQuery) && (
            <div className={s.activeFilters}>
              <div className={s.activeFiltersTitle}>Активные фильтры:</div>
              <div className={s.activeFiltersList}>
                {activeFilters.status !== "all" && (
                  <span className={s.activeFilter}>
                    Статус: {formatStatus(activeFilters.status)}
                  </span>
                )}
                {activeFilters.dateFrom && (
                  <span className={s.activeFilter}>
                    С: {new Date(activeFilters.dateFrom).toLocaleDateString('ru-RU')}
                  </span>
                )}
                {activeFilters.dateTo && (
                  <span className={s.activeFilter}>
                    По: {new Date(activeFilters.dateTo).toLocaleDateString('ru-RU')}
                  </span>
                )}
                {activeFilters.driverId && (
                  <span className={s.activeFilter}>
                    ID водителя: {activeFilters.driverId}
                  </span>
                )}
                {activeFilters.searchQuery && (
                  <span className={s.activeFilter}>
                    Поиск: {activeFilters.searchQuery}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Ошибка */}
        {error && (
          <div className={s.errorCard}>
            <p className={s.errorText}>{error}</p>
            <button
              type="button"
              className={s.primaryBtn}
              onClick={() => loadShipments()}
            >
              Попробовать снова
            </button>
          </div>
        )}

        {/* Пагинация сверху */}
        {total > 0 && (
          <div className={s.paginationTop}>
            <div className={s.pageInfo}>
              Показаны <b>{shipments.length}</b> из <b>{total}</b> доставок
              {totalPages > 1 && (
                <> • Страница <b>{page}</b> из <b>{totalPages}</b></>
              )}
            </div>
            <div className={s.pageSizeGroup}>
              <span className={s.pageSizeLabel}>На странице:</span>
              <select
                className={s.select}
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                disabled={loading}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        )}

        {/* Таблица */}
        <div className={s.tableContainer}>
          <div className={s.tableWrapper}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Водитель</th>
                  <th>Запланировано</th>
                  <th>Завершено</th>
                  <th>Статус</th>
                  <th>Заказов</th>
                  <th>Сумма</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {shipments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className={s.placeholder}>
                      {loading ? "Загрузка..." : "Нет доставок по выбранным фильтрам."}
                    </td>
                  </tr>
                ) : (
                  shipments.map((shipment) => {
                    const isOpen = openShipments[String(shipment.id)];
                    const shipmentAmount = shipment.orders.reduce((sum, item) => {
                      return sum + Number(item.order.total_amount || 0);
                    }, 0);

                    return (
                      <Fragment key={shipment.id}>
                        <tr className={loading ? s.loadingRow : ''}>
                          <td>
                            <span className={s.shipmentId}>{shipment.id}</span>
                          </td>
                          <td>
                            <div className={s.driverInfo}>
                              <div className={s.driverName}>
                                {formatDriverName(shipment.driver)}
                              </div>
                              <div className={s.driverPhone}>
                                {shipment.driver?.phone || "—"}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div>{formatDate(shipment.planned_at)}</div>
                            <div className={s.time}>{formatTime(shipment.planned_at)}</div>
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
                              className={`${s.statusBadge} ${getStatusClass(shipment.status)}`}
                            >
                              {formatStatus(shipment.status)}
                            </span>
                          </td>
                          <td>
                            {shipment.orders.length === 0 ? (
                              <span className={s.muted}>—</span>
                            ) : (
                              <button
                                type="button"
                                className={s.secondaryBtn}
                                onClick={() => toggleOpenShipment(shipment.id)}
                                disabled={loading}
                              >
                                {isOpen ? "Скрыть" : `${shipment.orders.length} зак.`}
                              </button>
                            )}
                          </td>
                          <td className={s.amountCell}>
                            <b>{money(shipmentAmount)} BYN</b>
                          </td>
                          <td className={s.actionsCell}>
                            <button
                              type="button"
                              className={s.secondaryBtn}
                              onClick={() => toggleOpenShipment(shipment.id)}
                              disabled={loading}
                            >
                              {isOpen ? "Свернуть" : "Детали"}
                            </button>
                          </td>
                        </tr>

                        {isOpen && shipment.orders.length > 0 && (
                          <tr>
                            <td colSpan={8} className={s.ordersCell}>
                              <div className={s.ordersList}>
                                <div className={s.ordersHeader}>
                                  <h4>Заказы в доставке {shipment.id}</h4>
                                  <div className={s.shipmentMeta}>
                                    {shipment.started_at && (
                                      <span>Начало: {formatDateTime(shipment.started_at)}</span>
                                    )}
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
                                
                                {shipment.orders.map((shipmentOrder) => (
                                  <div key={shipmentOrder.id} className={s.orderCard}>
                                    <div className={s.orderHeader}>
                                      <div className={s.orderTitleRow}>
                                        <h3 className={s.orderTitle}>
                                          Заказ {shipmentOrder.order.id}
                                          <span className={`${s.orderStatus} ${getStatusClass(shipmentOrder.order.status)}`}>
                                            {formatStatus(shipmentOrder.order.status)}
                                          </span>
                                          <span className={s.orderAmount}>
                                            {money(shipmentOrder.order.total_amount)} BYN
                                          </span>
                                        </h3>
                                        <button
                                          type="button"
                                          className={s.secondaryBtn}
                                          onClick={() => toggleOpenOrder(shipmentOrder.order.id)}
                                          disabled={loading}
                                        >
                                          {openOrders[String(shipmentOrder.order.id)] ? "Скрыть товары" : "Товары"}
                                        </button>
                                      </div>
                                      <div className={s.orderMeta}>
                                        <span>Клиент: {shipmentOrder.order.customer_name || "—"} • {shipmentOrder.order.customer_phone || "—"}</span>
                                        <span>Создан: {formatDateTime(shipmentOrder.order.created_at)}</span>
                                      </div>
                                    </div>

                                    {openOrders[String(shipmentOrder.order.id)] && (
                                      <div className={s.itemsList}>
                                        <table className={s.itemsTable}>
                                          <thead>
                                            <tr>
                                              <th>Товар</th>
                                              <th>SKU</th>
                                              <th>Кол-во</th>
                                              <th>Цена</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {shipmentOrder.order.items.map((item) => (
                                              <tr key={item.id}>
                                                <td>
                                                  <div>{item.productVariant?.product?.name || "Без названия"}</div>
                                                  {item.productVariant?.material?.name && (
                                                    <div className={s.muted}>Материал: {item.productVariant.material.name}</div>
                                                  )}
                                                </td>
                                                <td>
                                                  <code>{item.productVariant?.sku || "—"}</code>
                                                </td>
                                                <td>{item.quantity}</td>
                                                <td>{money(item.productVariant?.price)} BYN</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Пагинация снизу */}
        {totalPages > 1 && (
          <div className={s.paginationBottom}>
            <div className={s.pageInfo}>
              Страница <b>{page}</b> из <b>{totalPages}</b>
            </div>
            <div className={s.pageControls}>
              <button
                type="button"
                className={s.pageBtn}
                onClick={handlePrevPage}
                disabled={page <= 1 || loading}
              >
                Назад
              </button>
              <div className={s.pageNumbers}>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      className={`${s.pageNumber} ${page === pageNum ? s.pageNumberActive : ''}`}
                      onClick={() => setPage(pageNum)}
                      disabled={loading}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className={s.pageBtn}
                onClick={handleNextPage}
                disabled={page >= totalPages || loading}
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