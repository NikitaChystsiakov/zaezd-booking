"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/useToast";
import s from "./ManagerOrdersCreate.module.css";

type ProductVariant = {
  id: number;
  price: number;
  sku: string;
  active: boolean;
  material: { name: string; price_per_mm3: number };
};

type Product = {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  base_price: number;
  image_path: string | null;
  active: boolean;
  variants: ProductVariant[];
};

type DeliveryType = "pickup" | "home_delivery";

type FormState = {
  name: string;
  second_name: string;
  last_name: string;
  phone: string;
  email: string;
  deliveryType: DeliveryType;
  shopId: string;
  city: string;
  street: string;
  house: string;
  apartment: string;
  entrance: string;
  floor: string;
  note: string;
};

const initialForm: FormState = {
  name: "",
  second_name: "",
  last_name: "",
  phone: "",
  email: "",
  deliveryType: "pickup",
  shopId: "",
  city: "",
  street: "",
  house: "",
  apartment: "",
  entrance: "",
  floor: "",
  note: "",
};

type Shop = { id: number; city: string; street: string };
type ShopStock = { product_variant_id: number; quantity: number };

type DraftItem = {
  product_variant_id: number;
  title: string;
  unit_price: number;
  quantity: number;
  is_from_shop_stock: boolean;
  max_available?: number;
};

function toNum(v: any, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function normalizeProducts(raw: any): Product[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p: any) => {
    const baseVariant: ProductVariant = {
      id: toNum(p.id),
      price: toNum(p.base_price ?? p.price ?? 0),
      sku: String(p.sku ?? `SKU-${p.id}`),
      active: true,
      material: { name: "Базовый", price_per_mm3: 0 },
    };

    const variants =
      Array.isArray(p.variants) && p.variants.length > 0
        ? p.variants.map((v: any) => ({
            id: toNum(v.id),
            price: toNum(v.price ?? p.base_price ?? 0),
            sku: String(v.sku ?? ""),
            active: Boolean(v.active ?? true),
            material: {
              name: String(v.material?.name ?? "Материал"),
              price_per_mm3: toNum(v.material?.price_per_mm3),
            },
          }))
        : [baseVariant];

    return {
      id: toNum(p.id),
      name: String(p.name ?? ""),
      description: p.description ?? null,
      category: p.category ?? null,
      base_price: toNum(p.base_price ?? 0),
      image_path: p.image_path ?? null,
      active: true,
      variants,
    };
  });
}

function normalizeShops(raw: any): Shop[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((sh: any) => ({
    id: toNum(sh.id),
    city: String(sh.city ?? ""),
    street: String(sh.street ?? ""),
  }));
}

export default function ManagerNewOrderPage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopStock, setShopStock] = useState<ShopStock[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | "">("");
  const [selectedVariantId, setSelectedVariantId] = useState<number | "">("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [checkingStock, setCheckingStock] = useState(false);

  const loadShopStock = useCallback(async (shopId: number) => {
    try {
      const res = await fetch(`/api/v1/shops/${shopId}/stock`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Ошибка загрузки остатков");
      }
      const data = await res.json();
      setShopStock(data.stock || []);
    } catch (error: any) {
      console.error("Ошибка загрузки остатков:", error);
      toast.show({
        title: "Ошибка",
        description: error.message || "Не удалось загрузить остатки со склада",
      });
      setShopStock([]);
    }
  }, [toast]);

  // Получаем доступное количество на складе
  function getAvailableStock(variantId: number): number {
    if (!form.shopId) return 0;
    const stock = shopStock.find(s => s.product_variant_id === variantId);
    return stock ? stock.quantity : 0;
  }

  const hasFromStock = useMemo(
    () => items.some((i) => i.is_from_shop_stock),
    [items]
  );

 // Загружаем остатки склада при выборе магазина
 useEffect(() => {
  if (form.shopId) {
    loadShopStock(Number(form.shopId));
  } else {
    setShopStock([]);
  }
}, [form.shopId, loadShopStock]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  }

  // Проверяем остатки при изменении чекбокса "с магазина"
  function toggleFromStock(variantId: number, next: boolean) {
    if (next && !form.shopId) {
      toast.show({
        title: "Выберите магазин",
        description: "Для продажи с магазина сначала выберите магазин",
      });
      return;
    }

    if (next && form.shopId) {
      const available = getAvailableStock(variantId);
      const item = items.find(i => i.product_variant_id === variantId);
      
      if (available === 0) {
        toast.show({
          title: "Товара нет в наличии",
          description: "Выбранный товар отсутствует на складе магазина",
        });
        return;
      }

      if (item && item.quantity > available) {
        toast.show({
          title: "Недостаточно товара",
          description: `На складе только ${available} шт.`,
        });
        return;
      }
    }

    setItems((prev) =>
      prev.map((i) =>
        i.product_variant_id === variantId
          ? { ...i, is_from_shop_stock: next }
          : i
      )
    );
  }

  function addSelectedVariant() {
    if (!selectedVariantId || !selectedProduct) return;
    const variant = variants.find((v) => v.id === selectedVariantId);
    if (!variant) return;

    // При самовывозе по умолчанию НЕ ставим галочку "с магазина"
    const defaultFromStock = false;

    setItems((prev) => {
      const idx = prev.findIndex((i) => i.product_variant_id === variant.id);
      if (idx >= 0) {
        // Если товар уже есть в корзине, увеличиваем количество
        const copy = [...prev];
        copy[idx].quantity += 1;
        return copy;
      }
      return [
        ...prev,
        {
          product_variant_id: variant.id,
          title: `${selectedProduct.name}  ${variant.material.name}  ${variant.sku}`,
          unit_price: variant.price,
          quantity: 1,
          is_from_shop_stock: defaultFromStock,
        },
      ];
    });

    setSelectedVariantId("");
  }

  function setQty(variantId: number, quantity: number) {
    const item = items.find(i => i.product_variant_id === variantId);
    if (!item) return;

    // Если товар с магазина, проверяем доступность
    if (item.is_from_shop_stock && form.shopId) {
      const available = getAvailableStock(variantId);
      if (quantity > available) {
        toast.show({
          title: "Недостаточно товара",
          description: `На складе только ${available} шт.`,
        });
        quantity = Math.min(quantity, available);
      }
    }

    setItems((prev) =>
      prev.map((i) =>
        i.product_variant_id === variantId
          ? { ...i, quantity: Math.max(1, quantity) }
          : i
      )
    );
  }

  function removeItem(id: number) {
    setItems((prev) => prev.filter((i) => i.product_variant_id !== id));
  }

  // Проверяем все товары на складе перед отправкой
  async function validateStock(): Promise<boolean> {
    const fromStockItems = items.filter(i => i.is_from_shop_stock);
    if (!form.shopId || fromStockItems.length === 0) return true;

    setCheckingStock(true);
    try {
      const res = await fetch(`/api/v1/shops/${form.shopId}/stock/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: fromStockItems.map(i => ({ 
            product_variant_id: i.product_variant_id, 
            quantity: i.quantity 
          }))
        })
      });

      if (!res.ok) {
        const error = await res.json();
        toast.show({
          title: "Ошибка проверки склада",
          description: error.message || "Недостаточно товара на складе",
        });
        return false;
      }
      return true;
    } catch (error) {
      toast.show({
        title: "Ошибка",
        description: "Не удалось проверить остатки на складе",
      });
      return false;
    } finally {
      setCheckingStock(false);
    }
  }

  const totalUi = useMemo(
    () => items.reduce((s, i) => s + i.unit_price * i.quantity, 0),
    [items]
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (!items.length) {
      toast.show({
        title: "Добавьте товары",
        description: "Добавьте хотя бы один товар в заказ",
      });
      return;
    }

    if (items.some((i) => i.is_from_shop_stock) && !form.shopId) {
      toast.show({
        title: "Выберите магазин",
        description: "Для продажи с магазина нужно выбрать магазин",
      });
      return;
    }

    if (form.deliveryType === "pickup" && !form.shopId) {
      toast.show({
        title: "Выберите магазин",
        description: "Для самовывоза нужно выбрать магазин",
      });
      return;
    }

    // Проверяем остатки на складе (только для товаров "с магазина")
    const stockValid = await validateStock();
    if (!stockValid) return;

    setLoading(true);
    try {
      const res = await fetch("/api/v1/manager/orders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            name: form.name,
            second_name: form.second_name || undefined,
            last_name: form.last_name || undefined,
            phone: form.phone,
            email: form.email || undefined,
          },
          delivery: {
            type: form.deliveryType,
            shopId: form.shopId ? Number(form.shopId) : null,
            address:
              form.deliveryType === "home_delivery"
                ? {
                    city: form.city,
                    street: form.street,
                    house: form.house,
                    apartment: form.apartment || null,
                    entrance: form.entrance || null,
                    floor: form.floor || null,
                  }
                : null,
          },
          note: form.note || null,
          items: items.map((i) => ({
            product_variant_id: i.product_variant_id,
            quantity: i.quantity,
            is_from_shop_stock: i.is_from_shop_stock, 
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Ошибка создания заказа");

      const orderStatus = json.status === "delivered" ? "доставлен" : "создан";
      
      toast.show({
        title: "Заказ создан",
        description: `Заказ ${json.order?.id || ''} успешно оформлен и имеет статус "${orderStatus}"`,
        duration: 5000,
      });

      // Сброс формы
      setForm(initialForm);
      setItems([]);
      setSelectedProductId("");
      setSelectedVariantId("");
      setShopStock([]);
      
    } catch (e: any) {
      toast.show({
        title: "Ошибка",
        description: e.message || "Не удалось создать заказ",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const [prods, shopsData] = await Promise.all([
          fetch("/api/v1/products").then((r) => r.json()),
          fetch("/api/v1/shops").then((r) => r.json()).catch(() => []),
        ]);
        setProducts(normalizeProducts(prods));
        setShops(normalizeShops(shopsData));
      } catch (e) {
        console.error(e);
        toast.show({
          title: "Ошибка загрузки",
          description: "Не удалось загрузить товары или магазины",
        });
      }
    })();
  }, []);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) || null,
    [products, selectedProductId]
  );

  const variants = useMemo(() => selectedProduct?.variants || [], [selectedProduct]);

  return (
    <section className={s.wrapper}>
      <h2 className={s.title}>Новый офлайн-заказ</h2>

      <form className={s.form} onSubmit={submit}>
        <h3 className={s.h3}>Клиент</h3>
        <div className={s.row}>
          <input name="name" placeholder="Имя" value={form.name} onChange={handleChange} required />
          <input name="second_name" placeholder="Отчество" value={form.second_name} onChange={handleChange} />
          <input name="last_name" placeholder="Фамилия" value={form.last_name} onChange={handleChange} />
        </div>
        <div className={s.row}>
          <input name="phone" placeholder="Телефон" value={form.phone} onChange={handleChange} required />
          <input name="email" placeholder="Email" value={form.email} onChange={handleChange} />
        </div>

        <h3 className={s.h3}>Доставка</h3>
        <div className={s.row}>
          <select name="deliveryType" value={form.deliveryType} onChange={handleChange}>
            <option value="pickup">Самовывоз</option>
            <option value="home_delivery">Доставка</option>
          </select>

          {(form.deliveryType === "pickup" || hasFromStock) && (
            <select name="shopId" value={form.shopId} onChange={handleChange}>
              <option value="">Выберите магазин</option>
              {shops.map((sh) => (
                <option key={sh.id} value={sh.id}>
                  {sh.city}, {sh.street}
                </option>
              ))}
            </select>
          )}
        </div>

        {form.deliveryType === "home_delivery" && (
          <>
            <div className={s.row}>
              <input name="city" placeholder="Город" value={form.city} onChange={handleChange} />
              <input name="street" placeholder="Улица" value={form.street} onChange={handleChange} />
            </div>
            <div className={s.row}>
              <input name="house" placeholder="Дом" value={form.house} onChange={handleChange} />
              <input name="apartment" placeholder="Квартира" value={form.apartment} onChange={handleChange} />
            </div>
          </>
        )}

        <h3 className={s.h3}>Товары</h3>
        <div className={s.row}>
          <select
            value={selectedProductId}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : "";
              setSelectedProductId(val);
              setSelectedVariantId("");
            }}
          >
            <option value="">Выберите товар</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            disabled={!selectedProduct}
            value={selectedVariantId}
            onChange={(e) => setSelectedVariantId(Number(e.target.value) || "")}
          >
            <option value="">Выберите вариант</option>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.material.name} - {v.sku} - {v.price} BYN
              </option>
            ))}
          </select>

          <button type="button" className={s.secondary} onClick={addSelectedVariant}>
            Добавить
          </button>
        </div>

        {items.length > 0 && (
          <div className={s.items}>
            {items.map((i) => {
              const availableStock = i.is_from_shop_stock ? getAvailableStock(i.product_variant_id) : 0;
              
              return (
                <div key={i.product_variant_id} className={s.itemRow}>
                  <div className={s.itemTitle}>{i.title}</div>

                  <div className={s.itemRight}>
                    <div className={s.price}>{i.unit_price.toFixed(2)} BYN</div>

                    {/* Чекбокс "Со склада" с информацией о наличии */}
                    <label style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 10 }}>
                      <input
                        type="checkbox"
                        checked={i.is_from_shop_stock}
                        onChange={(e) => toggleFromStock(i.product_variant_id, e.target.checked)}
                        disabled={!form.shopId}
                      />
                      <span style={{ fontSize: 12, opacity: 0.8 }}>
                        С магазина
                        {i.is_from_shop_stock && form.shopId && (
                          <span style={{ color: availableStock < i.quantity ? 'crimson' : 'black', marginLeft: 4 }}>
                            ({availableStock} шт.)
                          </span>
                        )}
                      </span>
                    </label>

                    <input
                      className={s.qty}
                      type="number"
                      value={i.quantity}
                      min={1}
                      max={i.is_from_shop_stock && form.shopId ? availableStock : undefined}
                      onChange={(e) => setQty(i.product_variant_id, Number(e.target.value))}
                      style={i.is_from_shop_stock && i.quantity > availableStock ? { borderColor: 'crimson' } : {}}
                    />

                    <button
                      type="button"
                      className={s.remove}
                      onClick={() => removeItem(i.product_variant_id)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}

            <div className={s.total}>Итого: {totalUi.toFixed(2)} BYN</div>

            {items.some((x) => x.is_from_shop_stock) && !form.shopId && (
              <p className={s.message} style={{ color: "crimson" }}>
                Для позиций «с магазина» выберите магазин
              </p>
            )}
          </div>
        )}

        <button 
          className={s.primary} 
          type="submit" 
          disabled={loading || checkingStock}
        >
          {loading ? "Создаём…" : checkingStock ? "Проверяем склад…" : "Создать заказ"}
        </button>
      </form>
    </section>
  );
}