import { NextRequest, NextResponse } from "next/server";
import { verifyJwt } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { jsonSafe } from "@/lib/bigint";

class StockError extends Error {}

function getToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const cookieToken = req.cookies.get("auth_token")?.value || "";
  return bearer || cookieToken || null;
}

// ========================== GET ==========================
export async function GET(req: NextRequest) {
  try {
    const token = getToken(req);
    if (!token) return NextResponse.json({ message: "Нет доступа" }, { status: 401 });

    let payload: any;
    try {
      payload = await verifyJwt(token);
    } catch {
      return NextResponse.json({ message: "Неверный токен" }, { status: 401 });
    }

    if (payload.role !== "admin")
      return NextResponse.json({ message: "Доступ запрещён" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const shopIdParam = searchParams.get("shopId");

    const shops = await prisma.shops.findMany({
      where: { active: true },
      select: { id: true, city: true, street: true },
      orderBy: { id: "asc" },
    });

    if (shops.length === 0)
      return NextResponse.json({ shops: [], shop: null, stock: [] }, { status: 200 });

    let shopId = shopIdParam ? Number(shopIdParam) : Number(shops[0].id);
    if (!Number.isFinite(shopId)) shopId = Number(shops[0].id);

    const shop = shops.find((s) => Number(s.id) === shopId) ?? null;

    const stock = await prisma.shop_stock.findMany({
      where: { shop_id: BigInt(shopId) },
      select: {
        product_variant_id: true,
        quantity: true,
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
      orderBy: { product_variant_id: "asc" },
    });

    return NextResponse.json(jsonSafe({ shops, shop, shopId, stock }), { status: 200 });
  } catch (e) {
    console.error("admin shop-stock GET error:", e);
    return NextResponse.json({ message: "Ошибка при получении остатков" }, { status: 500 });
  }
}

// ========================== POST ==========================
export async function POST(req: NextRequest) {
  try {
    const token = getToken(req);
    if (!token) return NextResponse.json({ message: "Нет доступа" }, { status: 401 });

    let payload: any;
    try {
      payload = await verifyJwt(token);
    } catch {
      return NextResponse.json({ message: "Неверный токен" }, { status: 401 });
    }

    if (payload.role !== "admin")
      return NextResponse.json({ message: "Доступ запрещён" }, { status: 403 });

    const body = await req.json();
    const shopId = Number(body.shopId);
    const variantId = Number(body.product_variant_id ?? body.variantId ?? body.productVariantId);
    const amountRaw = Number(body.amount);
    const op = (body.operation as string) || "in";

    if (
      !Number.isInteger(shopId) ||
      shopId <= 0 ||
      !Number.isInteger(variantId) ||
      variantId <= 0 ||
      !Number.isFinite(amountRaw) ||
      amountRaw <= 0
    ) {
      return NextResponse.json(
        { message: "shopId, product_variant_id и amount > 0 обязательны" },
        { status: 400 }
      );
    }

    const qtyChange = op === "out" ? -amountRaw : amountRaw;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.shop_stock.findFirst({
        where: { shop_id: BigInt(shopId), product_variant_id: BigInt(variantId) },
      });

      const currentQty = existing?.quantity ?? 0;
      const nextQty = currentQty + qtyChange;

      if (nextQty < 0)
        throw new StockError(
          `Нельзя уменьшить количество ниже 0 (текущее: ${currentQty}, изменение: ${qtyChange})`
        );

      if (existing) {
        await tx.shop_stock.update({
          where: { id: existing.id },
          data: { quantity: nextQty },
        });
      } else {
        if (qtyChange < 0)
          throw new StockError("Нельзя создать позицию с отрицательным остатком");

        await tx.shop_stock.create({
          data: {
            shop_id: BigInt(shopId),
            product_variant_id: BigInt(variantId),
            quantity: nextQty,
          },
        });
      }

      await tx.shop_stock_moves.create({
        data: {
          shop_id: BigInt(shopId),
          product_variant_id: BigInt(variantId),
          qty_change: qtyChange,
          reason: "adjustment", 
          created_by: BigInt(payload.sub),
        },
      });

      return { new_quantity: nextQty };
    });

    return NextResponse.json(jsonSafe({ message: "Остаток обновлён", ...result }), { status: 200 });
  } catch (e: any) {
    if (e instanceof StockError)
      return NextResponse.json({ message: e.message }, { status: 400 });
    console.error("admin shop-stock POST error:", e);
    return NextResponse.json(
      { message: "Ошибка при изменении остатков" },
      { status: 500 }
    );
  }
}
