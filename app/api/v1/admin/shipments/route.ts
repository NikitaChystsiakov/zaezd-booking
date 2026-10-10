import { NextRequest, NextResponse } from "next/server";
import { verifyJwt } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { jsonSafe } from "@/lib/bigint";

/* ================= HELPERS ================= */

function getToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ")
    ? auth.slice(7).trim()
    : "";
  const cookieToken = req.cookies.get("auth_token")?.value || "";
  return bearer || cookieToken || null;
}

// Функция для валидации дат
function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

/* ================= GET ================= */

export async function GET(req: NextRequest) {
  try {
    /* ===== AUTH ===== */

    const token = getToken(req);
    if (!token) {
      return NextResponse.json(
        { message: "Нет доступа" },
        { status: 401 }
      );
    }

    let payload: any;
    try {
      payload = await verifyJwt(token);
    } catch {
      return NextResponse.json(
        { message: "Неверный токен" },
        { status: 401 }
      );
    }

    if (payload.role !== "admin") {
      return NextResponse.json(
        { message: "Доступ запрещён" },
        { status: 403 }
      );
    }

    /* ===== QUERY PARAMS ===== */

    const url = new URL(req.url);

    // Фильтры
    const status = url.searchParams.get("status");
    const driverId = url.searchParams.get("driverId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const search = url.searchParams.get("search"); // Поиск по ID доставки или заказа
    const sortBy = url.searchParams.get("sortBy") || "finished_at";
    const sortOrder = url.searchParams.get("sortOrder") || "desc";

    // Пагинация
    const page = Math.max(
      1,
      Number(url.searchParams.get("page") || 1)
    );
    const limit = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("limit") || 10))
    );

    const skip = (page - 1) * limit;

    /* ===== WHERE ===== */

    const where: any = {};

    // Статус (all = без фильтра)
    if (
      status &&
      status !== "all" &&
      ["planned", "in_transit", "delivered", "cancelled"].includes(status)
    ) {
      where.status = status;
    }


    if (driverId && !isNaN(Number(driverId))) {

      if (await prisma.shipments.findFirst({ where: { driver_id: BigInt(driverId) } })) {
        where.driver_id = BigInt(driverId);
      } 
    }

    // Дата завершения
    if (from || to) {
      where.finished_at = {};

      if (from && isValidDate(from)) {
        const fromDate = new Date(from);
        fromDate.setHours(0, 0, 0, 0);
        where.finished_at.gte = fromDate;
      }

      if (to && isValidDate(to)) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.finished_at.lte = toDate;
      }
      
      // Если указаны даты, но нет finished_at - ищем по planned_at
      if (!where.finished_at.gte && !where.finished_at.lte) {
        delete where.finished_at;
      }
    }

    // Поиск по ID доставки или заказа
    if (search) {
      const searchNum = Number(search);
      if (!isNaN(searchNum)) {
        where.OR = [
          { id: BigInt(searchNum) },
          {
            orders: {
              some: {
                order: {
                  id: BigInt(searchNum)
                }
              }
            }
          }
        ];
      }
    }

    /* ===== ORDER BY ===== */

    const orderBy: any[] = [];

    // Сортировка по умолчанию
    if (sortBy === "finished_at") {
      orderBy.push({ finished_at: sortOrder === "asc" ? "asc" : "desc" });
    } else if (sortBy === "planned_at") {
      orderBy.push({ planned_at: sortOrder === "asc" ? "asc" : "desc" });
    } else if (sortBy === "started_at") {
      orderBy.push({ started_at: sortOrder === "asc" ? "asc" : "desc" });
    } else if (sortBy === "status") {
      orderBy.push({ status: sortOrder === "asc" ? "asc" : "desc" });
    } else {
      // Сортировка по умолчанию
      orderBy.push(
        { finished_at: { sort: "asc", nulls: "first" } }, // NULL сначала
        { planned_at: "asc" },
        { finished_at: "desc" }
      );
    }

    /* ===== DB ===== */

    console.log("Query params:", {
      status,
      driverId,
      from,
      to,
      search,
      sortBy,
      sortOrder,
      page,
      limit,
      where
    });

    const [total, shipments] = await Promise.all([
      prisma.shipments.count({ where }),

      prisma.shipments.findMany({
        where,
        skip,
        take: limit,
        include: {
          driver: {
            select: {
              id: true,
              first_name: true,
              second_name: true,
              last_name: true,
              phone: true,
              email: true,
            },
          },
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
        orderBy,
      }),
    ]);

    console.log("Found shipments:", shipments.length);

    /* ===== RESPONSE ===== */

    return NextResponse.json(
      jsonSafe({
        shipments,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        filters: {
          status,
          driverId,
          from,
          to,
          search
        }
      }),
      { status: 200 }
    );
  } catch (e) {
    console.error("Admin shipments error:", e);
    return NextResponse.json(
      { message: "Ошибка при получении доставок", error: String(e) },
      { status: 500 }
    );
  }
}