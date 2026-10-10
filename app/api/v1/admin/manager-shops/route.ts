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

    // Менеджеры
    const managersRaw = await prisma.users.findMany({
      where: { role: "manager" as any },
      select: {
        id: true,
        email: true,
        phone: true,
        first_name: true,
        second_name: true,
        last_name: true,
      },
    });

    // Магазины
    const shopsRaw = await prisma.shops.findMany({
      where: { active: true },
      select: { id: true, city: true, street: true },
    });

    // Связки менеджер–магазин
    const links = await prisma.shop_managers.findMany({
      select: { user_id: true, shop_id: true },
    });

    const shops = shopsRaw.map((s) => ({
      id: Number(s.id),
      city: s.city,
      street: s.street,
    }));

    const managers = managersRaw.map((m) => {
      const managerShopIds = links
        .filter((l) => Number(l.user_id) === Number(m.id))
        .map((l) => Number(l.shop_id));

      const managerShops = shops.filter((s) =>
        managerShopIds.includes(s.id)
      );

      return {
        id: Number(m.id),
        email: m.email,
        phone: m.phone,
        first_name: m.first_name,
        second_name: m.second_name,
        last_name: m.last_name,
        shops: managerShops,
      };
    });

    return NextResponse.json(jsonSafe({ managers, shops }), { status: 200 });
  } catch (e) {
    console.error("admin manager-shops GET error:", e);
    return NextResponse.json(
      { message: "Ошибка получения списка менеджеров/магазинов" },
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

    if (payload.role !== "admin") {
      return NextResponse.json({ message: "Доступ запрещён" }, { status: 403 });
    }

    const body = await req.json();
    const managerId = Number(body.managerId);
    const shopId = Number(body.shopId);
    const action = String(body.action || "attach");

    if (!Number.isFinite(managerId) || !Number.isFinite(shopId)) {
      return NextResponse.json(
        { message: "managerId и shopId обязательны" },
        { status: 400 }
      );
    }

    const user_id = BigInt(managerId);
    const shop_id = BigInt(shopId);

    if (action === "attach") {
      // не создаём дубликат, если связь уже есть
      const exists = await prisma.shop_managers.findFirst({
        where: { user_id, shop_id },
      });

      if (!exists) {
        await prisma.shop_managers.create({
          data: { user_id, shop_id },
        });
      }
    } else if (action === "detach") {
      // deleteMany безопасен — даже если записи нет
      await prisma.shop_managers.deleteMany({
        where: { user_id, shop_id },
      });
    } else {
      return NextResponse.json(
        { message: "Неизвестное действие (нужно attach или detach)" },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: "Операция выполнена" }, { status: 200 });
  } catch (e) {
    console.error("admin manager-shops POST error:", e);
    return NextResponse.json(
      { message: "Ошибка при изменении привязки" },
      { status: 500 }
    );
  }
}
