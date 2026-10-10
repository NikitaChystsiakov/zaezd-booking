import { NextRequest, NextResponse } from "next/server";
import { verifyJwt } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { jsonSafe } from "@/lib/bigint";
import { z } from "zod";

class StockError extends Error {}

const managerOrderSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(1, "Имя обязательно"),
    second_name: z.string().trim().optional(),
    last_name: z.string().trim().optional(),
    phone: z.string().trim().min(5, "Номер телефона обязателен"),
    email: z.string().email().optional(),
  }),
  delivery: z.object({
    type: z.enum(["pickup", "home_delivery"]),
    shopId: z.number().int().nullable().optional(),
    address: z
      .object({
        city: z.string(),
        street: z.string(),
        house: z.string(),
        apartment: z.string().nullable().optional(),
        entrance: z.string().nullable().optional(),
        floor: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
  }),
  note: z.string().nullable().optional(),
  items: z
    .array(
      z.object({
        product_variant_id: z.number().int().positive(),
        quantity: z.number().int().positive(),
        is_from_shop_stock: z.boolean().optional().default(false),
      })
    )
    .min(1),
});

function getToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const cookieToken = req.cookies.get("auth_token")?.value || "";
  return bearer || cookieToken || null;
}

export async function POST(req: NextRequest) {
  try {
    const token = getToken(req);
    if (!token) {
      return NextResponse.json({ message: "Нет доступа" }, { status: 401 });
    }

    let payload: any;
    try {
      payload = await verifyJwt(token);
    } catch {
      return NextResponse.json({ message: "Неверный токен" }, { status: 401 });
    }

    if (payload.role !== "manager") {
      return NextResponse.json({ message: "Доступ запрещён" }, { status: 403 });
    }

    const json = await req.json();
    const parsed = managerOrderSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Неверные данные", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { customer, delivery, items, note } = parsed.data;

    // Доп.валидации доставки
    if (delivery.type === "pickup" && !delivery.shopId) {
      return NextResponse.json(
        { message: "Для самовывоза нужно выбрать магазин" },
        { status: 400 }
      );
    }
    if (delivery.type === "home_delivery" && !delivery.address) {
      return NextResponse.json(
        { message: "Для доставки нужен адрес" },
        { status: 400 }
      );
    }

    const variantIds = [...new Set(items.map((i) => i.product_variant_id))];

    const variants = await prisma.product_variants.findMany({
      where: { id: { in: variantIds.map(BigInt) } },
      select: { id: true, price: true, active: true },
    });

    const priceById = new Map<number, number>();
    for (const v of variants) {
      if (!v.active) {
        return NextResponse.json(
          { message: `Вариант товара ${Number(v.id)} неактивен` },
          { status: 400 }
        );
      }
      priceById.set(Number(v.id), Number(v.price));
    }

    for (const it of items) {
      if (!priceById.has(it.product_variant_id)) {
        return NextResponse.json(
          { message: `Вариант товара не найден: ${it.product_variant_id}` },
          { status: 400 }
        );
      }
    }

    const computedItems = items.map((it) => {
      const unit = priceById.get(it.product_variant_id)!;
      return {
        product_variant_id: BigInt(it.product_variant_id),
        quantity: it.quantity,
        unit_price: unit,
        line_total: unit * it.quantity,
        is_from_shop_stock: Boolean(it.is_from_shop_stock),
      };
    });

    const total = computedItems.reduce((sum, i) => sum + i.line_total, 0);

    const shopIdForStock = delivery.shopId ? delivery.shopId : null;
    const hasFromStockItems = items.some((i) => i.is_from_shop_stock);

    // Определяем статус заказа
    // ТОЛЬКО если есть товары, продаваемые со склада магазина -> статус delivered
    // В остальных случаях -> created
    const orderStatus = hasFromStockItems ? "delivered" : "created";

    // Транзакция: сперва проверяем/обновляем склад, затем создаём заказ
    const order = await prisma.$transaction(async (tx) => {
      // Если есть товары со склада магазина, проверяем и обновляем остатки
      if (hasFromStockItems && shopIdForStock) {
        const stockItems = items.filter((i) => i.is_from_shop_stock);

        if (stockItems.length > 0) {
          const variantIdsForStock = [
            ...new Set(stockItems.map((i) => i.product_variant_id)),
          ];

          const stockRows = await tx.shop_stock.findMany({
            where: {
              shop_id: BigInt(shopIdForStock),
              product_variant_id: { in: variantIdsForStock.map(BigInt) },
            },
            select: { product_variant_id: true, quantity: true },
          });

          const stockMap = new Map<number, number>();
          for (const row of stockRows) {
            stockMap.set(Number(row.product_variant_id), row.quantity);
          }

          const needPerVariant = new Map<number, number>();
          for (const it of stockItems) {
            const id = it.product_variant_id;
            needPerVariant.set(id, (needPerVariant.get(id) ?? 0) + it.quantity);
          }

          for (const [variantId, needQty] of needPerVariant) {
            const have = stockMap.get(variantId) ?? 0;
            if (have < needQty) {
              throw new StockError(
                `Недостаточно товара на складе (вариант ${variantId}): есть ${have}, нужно ${needQty}`
              );
            }
          }

          // обновляем остатки + пишем движения
          for (const [variantId, needQty] of needPerVariant) {
            await tx.shop_stock.updateMany({
              where: {
                shop_id: BigInt(shopIdForStock),
                product_variant_id: BigInt(variantId),
              },
              data: {
                quantity: {
                  decrement: needQty,
                },
              },
            });

            await tx.shop_stock_moves.create({
              data: {
                shop_id: BigInt(shopIdForStock),
                product_variant_id: BigInt(variantId),
                qty_change: -needQty,
                reason: "sale" as any,
                created_by: BigInt(payload.sub),
              },
            });
          }
        }
      }

      // создаём заказ
      const order = await tx.orders.create({
        data: {
          created_by: BigInt(payload.sub),
          shop_id: delivery.shopId ? BigInt(delivery.shopId) : null,

          customer_name: customer.name,
          customer_second_name: customer.second_name ?? null,
          customer_last_name: customer.last_name ?? null,
          customer_phone: customer.phone,
          customer_email: customer.email ?? null,

          delivery_type: delivery.type,
          status: orderStatus, // Используем вычисленный статус
          note: note ?? null,
          total_amount: total,

          items: { create: computedItems },

          address:
            delivery.type === "home_delivery" && delivery.address
              ? {
                  create: {
                    city: delivery.address.city,
                    street: delivery.address.street,
                    house: delivery.address.house,
                    apartment: delivery.address.apartment ?? null,
                    entrance: delivery.address.entrance ?? null,
                    floor: delivery.address.floor ?? null,
                  },
                }
              : undefined,
        },
        include: { items: true, address: true, shop: true },
      });

      return order;
    });

    return NextResponse.json(jsonSafe({ 
      message: "OK", 
      order,
      status: orderStatus // Возвращаем статус для информации
    }), { status: 201 });
  } catch (e: any) {
    if (e instanceof StockError) {
      return NextResponse.json({ message: e.message }, { status: 400 });
    }
    console.error("manager order create error:", e);
    return NextResponse.json(
      { message: "Ошибка при создании заказа" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
    try {
      const token = getToken(req);
      if (!token) {
        return NextResponse.json({ message: "Нет доступа" }, { status: 401 });
      }
  
      let payload: any;
      try {
        payload = await verifyJwt(token);
      } catch {
        return NextResponse.json({ message: "Неверный токен" }, { status: 401 });
      }
  
      if (payload.role !== "manager") {
        return NextResponse.json({ message: "Доступ запрещён" }, { status: 403 });
      }
  
      const { searchParams } = new URL(req.url);
      const status = searchParams.get("status") || undefined;
      const from = searchParams.get("from");
      const to = searchParams.get("to");
  
      const where: any = { created_by: BigInt(payload.sub) };
      if (status) where.status = status;
      if (from || to) {
        where.created_at = {};
        if (from) where.created_at.gte = new Date(from);
        if (to) where.created_at.lte = new Date(to);
      }
  
      const orders = await prisma.orders.findMany({
        where,
        include: {
          items: { include: { productVariant: true } },
          address: true,
          shop: true,
        },
        orderBy: { created_at: "desc" },
      });
  
      return NextResponse.json(jsonSafe({ orders }), { status: 200 });
    } catch (e) {
      console.error("manager orders list error:", e);
      return NextResponse.json(
        { message: "Ошибка при получении заказов" },
        { status: 500 }
      );
    }
  }