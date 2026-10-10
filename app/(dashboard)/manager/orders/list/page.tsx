"use client";

import { useEffect, useState } from "react";
import s from "./ManagerOrdersList.module.css";

type ProductVariant = {
  id: number;
  sku: string | null;
  price?: string | number | null;
};

type OrderItem = {
  id: number;
  product_variant_id: number;
  unit_price: string | number;
  quantity: number;
  is_from_shop_stock: boolean;
  productVariant: ProductVariant | null;
};

type Order = {
  id: number;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  total_amount: string | number;
  status: string;
  delivery_type: "pickup" | "home_delivery" | string;
  items?: OrderItem[];
};

function money(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? "—");
  return n.toFixed(2);
}

function formatDeliveryType(t: string) {
  if (t === "pickup") return "Самовывоз";
  if (t === "home_delivery") return "Доставка";
  return t || "—";
}

function itemTitle(it: OrderItem) {
  const pv = it.productVariant;
  const sku = pv?.sku ? `SKU: ${pv.sku}` : null;
  const vid = it.product_variant_id ? `Variant #${it.product_variant_id}` : null;
  return sku || vid || "Позиция";
}

function StatusBadge({ status }: { status: string }) {
  const getStatusClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'created': return s.statusCreated;
      case 'in_production': return s.statusInProduction;
      case 'ready_to_ship': return s.statusReadyToShip;
      case 'in_transit': return s.statusInTransit;
      case 'delivered': return s.statusDelivered;
      case 'cancelled': return s.statusCancelled;
      default: return s.statusCreated;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'created': return 'Создан';
      case 'in_production': return 'В производстве';
      case 'ready_to_ship': return 'Готов к отправке';
      case 'in_transit': return 'В пути';
      case 'delivered': return 'Доставлен';
      case 'cancelled': return 'Отменен';
      default: return status;
    }
  };

  return (
    <span className={`${s.statusBadge} ${getStatusClass(status)}`}>
      {getStatusLabel(status)}
    </span>
  );
}

export default function ManagerOrdersList() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetch("/api/v1/manager/orders")
      .then((r) => r.json())
      .then((data) => setOrders(data.orders || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className={s.muted}>Загрузка...</p>;
  if (orders.length === 0) return <p className={s.muted}>Нет заказов</p>;

  return (
    <section className={s.wrapper}>
      <h2 className={s.title}>Мои заказы</h2>

      <div className={s.tableWrapper}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Дата</th>
              <th>Клиент</th>
              <th>Телефон</th>
              <th>Тип</th>
              <th>Статус</th>
              <th>Сумма</th>
              <th>Товары</th>
            </tr>
          </thead>

          <tbody>
            {orders.map((o) => {
              const isOpen = Boolean(open[o.id]);
              const items = Array.isArray(o.items) ? o.items : [];

              return (
                <>
                  <tr key={o.id}>
                    <td>{o.id}</td>
                    <td>{new Date(o.created_at).toLocaleString("ru-RU")}</td>
                    <td>{o.customer_name || "—"}</td>
                    <td>{o.customer_phone || "—"}</td>
                    <td>{formatDeliveryType(o.delivery_type)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td>{money(o.total_amount)} BYN</td>
                    <td>
                      <button
                        type="button"
                        className={s.secondaryBtn}
                        onClick={() => setOpen((p) => ({ ...p, [o.id]: !p[o.id] }))}
                        disabled={items.length === 0}
                        title={items.length === 0 ? "Нет позиций" : ""}
                      >
                        {items.length === 0
                          ? "Нет"
                          : isOpen
                          ? "Скрыть"
                          : `Показать `}
                      </button>
                    </td>
                  </tr>

                  {isOpen && items.length > 0 && (
                    <tr key={`${o.id}-items`}>
                      <td colSpan={8} className={s.itemsCell}>
                        <div className={s.itemsBox}>
                          {items.map((it) => (
                            <div key={it.id} className={s.itemRow}>
                              <div className={s.itemLeft}>
                                <div className={s.itemTitle}>{itemTitle(it)}</div>
                                <div className={s.badges}>
                                  <span
                                    className={
                                      it.is_from_shop_stock ? s.badgeGreen : s.badgeGray
                                    }
                                  >
                                    {it.is_from_shop_stock ? "С магазина" : "Под заказ"}
                                  </span>
                                </div>
                              </div>

                              <div className={s.itemRight}>
                                <div className={s.itemMeta}>
                                  <span>Количество: <b>{it.quantity}</b></span>
                                  <span>Цена: <b>{money(it.unit_price)} BYN</b></span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}