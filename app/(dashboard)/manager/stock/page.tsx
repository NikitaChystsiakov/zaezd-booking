"use client";

import { useEffect, useMemo, useState } from "react";
import s from "./ManagerStock.module.css";
import { useToast } from "@/hooks/useToast";

type Shop = {
  id: number | string;
  city: string;
  street: string;
  active?: boolean;
};

type StockRow = {
  product_variant_id: number | string;
  quantity: number;
  productVariant: {
    id: number | string;
    sku: string | null;
    price: number | string | null;
    product?: { name: string | null } | null;
    material?: { name: string | null } | null;
  } | null;
};

type ApiResponse = {
  shop: Shop | null;
  stock: StockRow[];
  message?: string;
};

export default function ManagerStockPage() {
  const toast = useToast();

  const [shop, setShop] = useState<Shop | null>(null);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      setErr(null);
      setLoading(true);

      const res = await fetch("/api/v1/manager/stock", {
        credentials: "include",
      });

      const json: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.message || "Ошибка загрузки склада");
      }

      setShop(json.shop ?? null);
      setStock(Array.isArray(json.stock) ? json.stock : []);

      if (json.message) {
        toast.show({
          title: "Информация",
          description: json.message,
        });
      }
    } catch (e: any) {
      const msg = e?.message ?? "Ошибка загрузки склада";
      setErr(msg);
      setShop(null);
      setStock([]);
      toast.show({ title: "Ошибка", description: msg });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPositions = stock.length;
  const totalQty = useMemo(
    () => stock.reduce((s, row) => s + (row.quantity ?? 0), 0),
    [stock],
  );

  function formatMoney(v: any) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return n.toFixed(2);
  }

  if (loading) {
    return (
      <section className={s.wrapper}>
        <div className={s.card}>
          <p className={s.muted}>Загрузка склада магазина…</p>
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

  // если менеджеру ничего не закрепили
  if (!shop) {
    return (
      <section className={s.wrapper}>
        <div className={s.card}>
          <h1 className={s.title}>Склад магазина</h1>
          <p className={s.placeholder}>
            За вами пока не закреплён ни один магазин.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={s.wrapper}>
      <div className={s.card}>
        <div className={s.headerRow}>
          <h1 className={s.title}>Склад моего магазина</h1>
          <div className={s.headerActions}>
            <span className={s.muted}>
              Позиции: <b>{totalPositions}</b>  Всего штук:{" "}
              <b>{totalQty}</b>
            </span>
          </div>
        </div>

        <div className={s.shopRow}>
          <div className={s.shopInfo}>
            <span className={s.shopLabel}>Магазин:</span>
            <span className={s.shopName}>
              {String(shop.id)}  {shop.city}, {shop.street}
            </span>
          </div>
        </div>

        {/* Десктопная таблица */}
        <div className={s.tableContainer}>
          <div className={s.tableWrapper}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>ID варианта</th>
                  <th>Товар</th>
                  <th>SKU</th>
                  <th>Цена</th>
                  <th>Количество</th>
                </tr>
              </thead>
              <tbody>
                {stock.length === 0 && (
                  <tr>
                    <td colSpan={5} className={s.placeholder}>
                      Для этого магазина нет позиций на складе.
                    </td>
                  </tr>
                )}

                {stock.map((row) => {
                  const pv = row.productVariant;
                  const id = Number(row.product_variant_id);
                  const name = pv?.product?.name ?? "";
                  const material = pv?.material?.name
                    ? `  ${pv.material.name}`
                    : "";
                  const sku = pv?.sku ?? "—";

                  return (
                    <tr key={id}>
                      <td>{id}</td>
                      <td>
                        {name || "Без названия"}
                        {material && (
                          <span className={s.muted}>{material}</span>
                        )}
                      </td>
                      <td>{sku}</td>
                      <td>{formatMoney(pv?.price)} BYN</td>
                      <td className={s.qtyCell}>{row.quantity}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Мобильные карточки */}
        <div className={s.mobileList}>
          {stock.length === 0 && (
            <div className={s.placeholder}>
              Для этого магазина нет позиций на складе.
            </div>
          )}

          {stock.map((row) => {
            const pv = row.productVariant;
            const id = Number(row.product_variant_id);
            const name = pv?.product?.name ?? "";
            const material = pv?.material?.name
              ? `  ${pv.material.name}`
              : "";
            const sku = pv?.sku ?? "—";

            return (
              <div key={id} className={s.stockCard}>
                <div className={s.stockTitle}>
                  {name || "Без названия"}
                  {material && <span className={s.muted}>{material}</span>}
                </div>
                <div className={s.stockMeta}>
                  ID варианта: {id}  SKU: {sku}
                </div>
                <div className={s.stockMeta}>
                  Цена: {formatMoney(pv?.price)} BYN
                </div>
                <div className={s.stockQty}>На складе: {row.quantity}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
