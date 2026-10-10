// app/api/v1/driver/history/route.ts - исправленный
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

    const url = new URL(req.url);
    const status = url.searchParams.get("status") as "delivered" | "cancelled" | null;
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const driverId = BigInt(payload.sub);
    
    // Базовые условия
    const where: any = {
      driver_id: driverId,
      status: { in: ["delivered", "cancelled"] }
    };

    // Применяем фильтр по статусу
    if (status && (status === "delivered" || status === "cancelled")) {
      where.status = status;
    }

    // Применяем фильтр по дате
    if (from || to) {
      where.finished_at = {};
      
      if (from) {
        const fromDate = new Date(from);
        where.finished_at.gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.finished_at.lte = toDate;
      }
    }

    // Получаем все завершённые доставки водителя
    const shipments = await prisma.shipments.findMany({
      where,
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
      orderBy: [
        { finished_at: "desc" }
      ],
    });
    
    // Преобразуем BigInt в строки
    const safeShipments = jsonSafe(shipments);
    
    return NextResponse.json({ shipments: safeShipments }, { status: 200 });
  } catch (e) {
    console.error("Error fetching driver history:", e);
    return NextResponse.json({ message: "Ошибка при получении истории доставок" }, { status: 500 });
  }
}