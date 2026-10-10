import { NextRequest, NextResponse } from "next/server";
import { verifyJwt } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { jsonSafe } from "@/lib/bigint";

function getToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const cookieToken = req.cookies.get("auth_token")?.value || "";
  return bearer || cookieToken || null;
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

    if (payload.role !== "admin") {
      return NextResponse.json({ message: "Доступ запрещён" }, { status: 403 });
    }

    const rawOrders = await prisma.orders.findMany({
      where: {
        factory_worker_id: { not: null }, // только заказы, у которых есть работник
      },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        created_at: true,
        status: true,
        delivery_type: true,
        customer_name: true,
        customer_phone: true,
        total_amount: true,
        factory_worker_id: true,
        shop: {
          select: {
            id: true,
            city: true,
            street: true,
          },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            is_from_shop_stock: true,
            productVariant: {
              select: {
                id: true,
                sku: true,
                price: true,
                product: { select: { name: true } },
                material: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    // Собираем id всех рабочих
    const workerIds = Array.from(
      new Set(
        rawOrders
          .map((o) => o.factory_worker_id)
          .filter((id): id is bigint => id !== null)
          .map((id) => id)
      )
    );

    const workers = workerIds.length
      ? await prisma.users.findMany({
          where: {
            id: { in: workerIds },
          },
          select: {
            id: true,
            email: true,
            first_name: true,
            second_name: true,
            last_name: true,
            phone: true,
          },
        })
      : [];

    const workerMap = new Map(
      workers.map((u) => [u.id.toString(), u])
    );

    const orders = rawOrders.map((o) => {
      const worker =
        o.factory_worker_id != null
          ? workerMap.get(o.factory_worker_id.toString()) ?? null
          : null;

      return {
        id: Number(o.id),
        created_at: o.created_at,
        status: o.status,
        delivery_type: o.delivery_type,
        customer_name: o.customer_name,
        customer_phone: o.customer_phone,
        total_amount: o.total_amount,
        shop: o.shop
          ? {
              id: Number(o.shop.id),
              city: o.shop.city,
              street: o.shop.street,
            }
          : null,
        factory_worker_id: o.factory_worker_id
          ? Number(o.factory_worker_id)
          : null,
        worker: worker
          ? {
              id: Number(worker.id),
              email: worker.email,
              first_name: worker.first_name,
              second_name: worker.second_name,
              last_name: worker.last_name,
              phone: worker.phone,
            }
          : null,
        items: o.items.map((it) => ({
          id: Number(it.id),
          quantity: it.quantity,
          is_from_shop_stock: it.is_from_shop_stock,
          productVariant: it.productVariant
            ? {
                id: Number(it.productVariant.id),
                sku: it.productVariant.sku,
                price: it.productVariant.price,
                product: {
                  name: it.productVariant.product?.name ?? null,
                },
                material: {
                  name: it.productVariant.material?.name ?? null,
                },
              }
            : null,
        })),
      };
    });

    return NextResponse.json(jsonSafe({ orders }), { status: 200 });
  } catch (e) {
    console.error("admin factory-orders GET error:", e);
    return NextResponse.json(
      { message: "Ошибка при получении заказов производства" },
      { status: 500 }
    );
  }
}
