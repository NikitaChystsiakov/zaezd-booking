// app/(admin)/admin/shop-stock/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import s from "./AdminShopStock.module.css";
import { useToast } from "@/hooks/useToast";
import Link from "next/link";

type Shop = {
  id: number | string;
  city: string;
  street: string;
};

type ProductVariantShort = {
  id: number;
  label: string;
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
  shops: Shop[];
  shop: Shop | null;
  shopId: number | string | null;
  stock: StockRow[];
  message?: string;
};

export default function AdminShopStockPage() {
  const toast = useToast();

  const [shops, setShops] = useState<Shop[]>([]);
  const [currentShopId, setCurrentShopId] = useState<number | null>(null);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [variants, setVariants] = useState<ProductVariantShort[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<number | null>(null);
  const [operation, setOperation] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState<string>("");

  async function loadProducts() {
    try {
      const res = await fetch("/api/v1/products", { credentials: "include" });
      const data = await res.json();
      if (!Array.isArray(data)) return;

      const out: ProductVariantShort[] = [];

      for (const p of data) {
        const productName = String(p.name ?? "");
        const variantsArr = Array.isArray(p.variants) ? p.variants : [];
        if (variantsArr.length === 0) continue;

        for (const v of variantsArr) {
          const id = Number(v.id);
          if (!Number.isFinite(id)) continue;

          const material = v.material?.name ? `  ${v.material.name}` : "";
          const sku = v.sku ? `  ${v.sku}` : "";

          out.push({
            id,
            label: `${productName}${material}${sku}`,
          });
        }
      }

      out.sort((a, b) => a.label.localeCompare(b.label, "ru"));
      setVariants(out);
    } catch (e) {
      console.error("loadProducts error", e);
    }
  }

  // загрузка склада
  async function load(shopId?: number | null) {
    try {
      setErr(null);
      setLoading(true);

      const q = shopId ? `?shopId=${shopId}` : "";
      const res = await fetch(`/api/v1/admin/shop-stock${q}`, {
        credentials: "include",
      });
      const json: ApiResponse = await res.json();
      if (!res.ok) throw new Error(json.message || "Ошибка загрузки склада");

      const shopsList = Array.isArray(json.shops) ? json.shops : [];
      setShops(shopsList);

      const resolvedShopId =
        shopId ??
        (json.shopId != null
          ? Number(json.shopId)
          : shopsList[0] && Number(shopsList[0].id));

      setCurrentShopId(
        Number.isFinite(resolvedShopId) ? Number(resolvedShopId) : null
      );

      setStock(Array.isArray(json.stock) ? json.stock : []);
    } catch (e: any) {
      const msg = e?.message ?? "Ошибка загрузки склада";
      setErr(msg);
      setStock([]);
      toast.show({ title: "Ошибка", description: msg });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentShop = useMemo(
    () => shops.find((s) => Number(s.id) === currentShopId) ?? null,
    [shops, currentShopId]
  );

  async function applyChange() {
    if (!currentShopId) {
      toast.show({ title: "Ошибка", description: "Выберите магазин" });
      return;
    }
    if (!selectedVariant) {
      toast.show({ title: "Ошибка", description: "Выберите товар / вариант" });
      return;
    }

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.show({
        title: "Ошибка",
        description: "Количество должно быть положительным числом",
      });
      return;
    }

    try {
      setSaving(true);

      const res = await fetch("/api/v1/admin/shop-stock", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId: Number(currentShopId),
          product_variant_id: Number(selectedVariant),
          amount: amt,
          operation,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Ошибка изменения остатков");

      toast.show({
        title: "Остаток обновлён",
        description:
          json.new_quantity != null
            ? `Новый остаток: ${json.new_quantity}`
            : undefined,
      });

      setAmount("");
      await load(Number(currentShopId));
    } catch (e: any) {
      toast.show({
        title: "Ошибка",
        description: e?.message ?? "Не удалось изменить остаток",
      });
    } finally {
      setSaving(false);
    }
  }

  const totalPositions = stock.length;
  const totalQty = stock.reduce((s, row) => s + (row.quantity ?? 0), 0);

  function formatMoney(v: any) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return n.toFixed(2);
  }

  if (loading) {
    return (
      <section className={s.wrapper}>
        <div className={s.card}>
          <p className={s.muted}>Загрузка склада…</p>
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
          <h1 className={s.title}>Склад магазинов</h1>
          <div className={s.headerActions}>
            <span className={s.muted}>
              Позиции: <b>{totalPositions}</b> Всего штук: <b>{totalQty}</b>
              <Link className={s.secondary} href="/admin">
                ← Назад
              </Link>
            </span>
          </div>
        </div>

        {/* Выбор магазина */}
        <div className={s.shopRow}>
          <div className={s.shopInfo}>
            <span className={s.shopLabel}>Магазин:</span>
            {currentShop ? (
              <span className={s.shopName}>
                {String(currentShop.id)}  {currentShop.city},{" "}
                {currentShop.street}
              </span>
            ) : (
              <span className={s.muted}>Не выбран</span>
            )}
          </div>
          <select
            className={s.shopSelect}
            value={currentShopId ?? ""}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : null;
              setCurrentShopId(val);
              load(val);
            }}
          >
            {shops.length === 0 && <option value="">Магазинов нет</option>}
            {shops.map((sh) => (
              <option key={String(sh.id)} value={Number(sh.id)}>
                {sh.city}, {sh.street}
              </option>
            ))}
          </select>
        </div>

        {/* Панель ручной корректировки */}
        <div className={s.adjustCard}>
          <div className={s.adjustHeader}>
            <div className={s.adjustTitle}>Ручная корректировка остатков</div>
            <div className={s.adjustHint}>
              Выберите товар, операцию и количество. Для прихода, остаток увеличивается, для списания, он уменьшается.
            </div>
          </div>

          <div className={s.adjustGrid}>
            <div className={s.field}>
              <label>Товар / вариант</label>
              <select
                className={s.select}
                value={selectedVariant ?? ""}
                onChange={(e) =>
                  setSelectedVariant(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              >
                <option value="">Выберите вариант</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={s.field}>
              <label>Операция</label>
              <div className={s.operationSwitch}>
                <button
                  type="button"
                  className={`${s.switchButton} ${operation === "in" ? s.activeIn : ""
                    }`}
                  onClick={() => setOperation("in")}
                >
                  Приход
                </button>
                <button
                  type="button"
                  className={`${s.switchButton} ${operation === "out" ? s.activeOut : ""
                    }`}
                  onClick={() => setOperation("out")}
                >
                  Списание
                </button>
              </div>
            </div>

            <div className={s.field}>
              <label>Количество</label>
              <input
                className={s.input}
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Количество"
              />
            </div>

            <div className={s.fieldSubmit}>
              <button
                type="button"
                className={s.primaryBtn}
                onClick={applyChange}
                disabled={saving}
              >
                {saving ? "Сохраняем…" : "Применить изменение"}
              </button>
            </div>
          </div>
        </div>

        {/* Таблица для десктопа */}
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
                        {material && <span className={s.muted}>{material}</span>}
                      </td>
                      <td>{sku}</td>
                      <td>{formatMoney(pv?.price)} BYN</td>
                      <td>{row.quantity}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Карточки для мобилы */}
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
              ? ` • ${pv.material.name}`
              : "";
            const sku = pv?.sku ?? "—";

            return (
              <div key={id} className={s.stockCard}>
                <div className={s.stockTitle}>
                  {name || "Без названия"}
                  {material && <span className={s.muted}>{material}</span>}
                </div>
                <div className={s.stockMeta}>
                  ID варианта: {id} • SKU: {sku}
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
