// app/api/v1/factory/orders/route.ts
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

    if (payload.role !== "factory_worker") {
      return NextResponse.json(
        { message: "Доступ запрещён" },
        { status: 403 }
      );
    }

    // все "свободные" заказы
    const available = await prisma.orders.findMany({
      where: { status: "created" as any },
      include: {
        shop: { select: { id: true, city: true, street: true } },
        items: {
          include: {
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
      orderBy: { created_at: "asc" },
    });

    // заказы, которые ведёт этот работник
    const mine = await prisma.orders.findMany({
      where: {
        factory_worker_id: BigInt(payload.sub),
        status: {
          in: ["in_production", "ready_to_ship"] as any,
        },
      },
      include: {
        shop: { select: { id: true, city: true, street: true } },
        items: {
          include: {
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
      orderBy: { created_at: "asc" },
    });

    return NextResponse.json(jsonSafe({ available, mine }), {
      status: 200,
    });
  } catch (e) {
    console.error("factory orders GET error:", e);
    return NextResponse.json(
      { message: "Ошибка при получении заказов" },
      { status: 500 }
    );
  }
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

    if (payload.role !== "factory_worker") {
      return NextResponse.json(
        { message: "Доступ запрещён" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const orderId = Number(body.orderId);
    const action = String(body.action || "");

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return NextResponse.json(
        { message: "orderId должен быть положительным числом" },
        { status: 400 }
      );
    }

    const order = await prisma.orders.findUnique({
      where: { id: BigInt(orderId) },
      select: {
        id: true,
        status: true,
        factory_worker_id: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { message: "Заказ не найден" },
        { status: 404 }
      );
    }

    const workerId = BigInt(payload.sub);
    const data: any = {};

    if (action === "take") {
      if (order.status !== "created") {
        return NextResponse.json(
          { message: "Этот заказ нельзя взять в производство (не статус created)" },
          { status: 400 }
        );
      }
      data.status = "in_production" as any;
      data.factory_worker_id = workerId;
    } else if (action === "mark_ready") {
      if (order.status !== "in_production") {
        return NextResponse.json(
          { message: "Этот заказ нельзя отметить готовым (не статус in_production)" },
          { status: 400 }
        );
      }
      if (!order.factory_worker_id || order.factory_worker_id !== workerId) {
        return NextResponse.json(
          { message: "Вы не являетесь исполнителем этого заказа" },
          { status: 403 }
        );
      }
      data.status = "ready_to_ship" as any;
    } else {
      return NextResponse.json(
        { message: "Неизвестное действие. Используйте 'take' или 'mark_ready'" },
        { status: 400 }
      );
    }

    const updated = await prisma.orders.update({
      where: { id: BigInt(orderId) },
      data,
      include: {
        shop: { select: { id: true, city: true, street: true } },
        items: {
          include: {
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

    return NextResponse.json(
      jsonSafe({
        message:
          action === "take"
            ? "Заказ взят в производство"
            : "Заказ отмечен как готов к отгрузке",
        order: updated,
      }),
      { status: 200 }
    );
  } catch (e) {
    console.error("factory orders POST error:", e);
    return NextResponse.json(
      { message: "Ошибка при изменении статуса заказа" },
      { status: 500 }
    );
  }
}
