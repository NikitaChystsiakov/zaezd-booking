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

    if (payload.role !== "manager") {
      return NextResponse.json({ message: "Доступ запрещён" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const shopIdParam = searchParams.get("shopId");

    // Магазины, к которым привязан менеджер
    const managerLinks = await prisma.shop_managers.findMany({
      where: { user_id: BigInt(payload.sub) },
      select: { shop_id: true },
    });

    const allowedShopIds = managerLinks.map((l) => Number(l.shop_id));

    // Если ни одного магазина не привязано
    if (allowedShopIds.length === 0) {
      return NextResponse.json(
        jsonSafe({
          message: "За вами не закреплён ни один магазин",
          shop: null,
          stock: [],
        }),
        { status: 200 },
      );
    }

    // Определяем, с каким магазином работаем
    let shopId: number;

    if (shopIdParam !== null) {
      const parsed = Number(shopIdParam);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return NextResponse.json(
          { message: "Некорректный параметр shopId" },
          { status: 400 },
        );
      }
      if (!allowedShopIds.includes(parsed)) {
        return NextResponse.json(
          { message: "У вас нет доступа к этому магазину" },
          { status: 403 },
        );
      }
      shopId = parsed;
    } else {
      // если shopId не передан — берём первый доступный
      shopId = allowedShopIds[0];
    }

    const shop = await prisma.shops.findUnique({
      where: { id: BigInt(shopId) },
      select: { id: true, city: true, street: true, active: true },
    });

    // Если магазин вдруг удалили/деактивировали
    if (!shop || !shop.active) {
      return NextResponse.json(
        jsonSafe({
          message: "Магазин недоступен или деактивирован",
          shop: null,
          stock: [],
        }),
        { status: 200 },
      );
    }

    const stock = await prisma.shop_stock.findMany({
      where: { shop_id: BigInt(shopId) },
      select: {
        product_variant_id: true,
        quantity: true,
        // имя связи в Prisma — именно productVariant
        productVariant: {
          select: {
            id: true,
            sku: true,
            price: true,
            // связи у варианта: product и material
            product: { select: { name: true } },
            material: { select: { name: true } },
          },
        },
      },
      orderBy: { product_variant_id: "asc" },
    });

    return NextResponse.json(
      jsonSafe({
        shop,
        stock,
      }),
      { status: 200 },
    );
  } catch (e) {
    console.error("manager stock GET error:", e);
    return NextResponse.json(
      { message: "Ошибка при получении остатков" },
      { status: 500 },
    );
  }
}
