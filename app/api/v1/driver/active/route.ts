// app/api/v1/driver/active-orders.ts
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

    if (payload.role !== "driver") {
      return NextResponse.json({ message: "Доступ запрещён" }, { status: 403 });
    }

    // Получаем все активные заказы водителя
    const shipments = await prisma.shipments.findMany({
      where: { 
        driver_id: BigInt(payload.sub), 
        status: { in: ["in_transit"] } 
      },
      include: {
        orders: {
          include: {
            order: {
              include: {
                address: true,
                shop: true,
                items: {
                  include: {
                    productVariant: {
                      include: {
                        product: { select: { name: true } },
                        material: { select: { name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { planned_at: "asc" },
    });

    // Преобразуем BigInt в строки с помощью вашей функции
    const safeShipments = jsonSafe(shipments);
    
    return NextResponse.json({ shipments: safeShipments }, { status: 200 });
  } catch (e) {
    console.error("Error fetching active shipments:", e);
    return NextResponse.json({ message: "Ошибка при получении активных заказов" }, { status: 500 });
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

    if (payload.role !== "driver") {
      return NextResponse.json({ message: "Доступ запрещён" }, { status: 403 });
    }

    const body = await req.json();
    const shipmentId = Number(body.shipmentId);
    const action = body.action;

    if (!Number.isInteger(shipmentId) || shipmentId <= 0) {
      return NextResponse.json({ message: "shipmentId должен быть положительным числом" }, { status: 400 });
    }

    const driverId = BigInt(payload.sub);
    const bigShipmentId = BigInt(shipmentId);

    // Используем транзакцию для атомарного обновления
    await prisma.$transaction(async (tx) => {
      // Получаем shipment с проверкой прав доступа
      const shipment = await tx.shipments.findUnique({
        where: { 
          id: bigShipmentId,
          driver_id: driverId, // Проверяем, что водитель имеет доступ
        },
        include: {
          orders: {
            include: {
              order: true,
            },
          },
        },
      });

      if (!shipment) {
        throw new Error("Доставка не найдена или у вас нет к ней доступа");
      }

      if (shipment.status !== "in_transit") {
        throw new Error("Этот заказ не в пути");
      }

      const data: any = { finished_at: new Date() };

      if (action === "deliver") {
        data.status = "delivered";
        
        // Обновляем все связанные заказы
        for (const shipmentOrder of shipment.orders) {
          await tx.orders.update({
            where: { id: shipmentOrder.order.id },
            data: { status: "delivered" },
          });
        }
      } else if (action === "cancel") {
        data.status = "cancelled";
        
        // Обновляем все связанные заказы
        for (const shipmentOrder of shipment.orders) {
          await tx.orders.update({
            where: { id: shipmentOrder.order.id },
            data: { status: "cancelled" },
          });
        }
      } else {
        throw new Error("Неизвестное действие");
      }

      // Обновляем shipment
      await tx.shipments.update({
        where: { id: bigShipmentId },
        data,
      });
    });

    const message = action === "deliver" ? "Заказ доставлен" : "Доставка отменена";
    
    return NextResponse.json({ 
      message,
      success: true 
    }, { status: 200 });
    
  } catch (e) {
    console.error("Error changing shipment status:", e);
    
    return NextResponse.json({ 
      message: e instanceof Error ? e.message : "Ошибка при изменении статуса доставки",
      success: false
    }, { status: 500 });
  }
}