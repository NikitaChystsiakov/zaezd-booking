// app/api/v1/shops/[shopId]/stock/check/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyJwt } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { jsonSafe } from "@/lib/bigint";
import { z } from "zod";

function getToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const cookieToken = req.cookies.get("auth_token")?.value || "";
  return bearer || cookieToken || null;
}

const checkStockSchema = z.object({
  items: z.array(
    z.object({
      product_variant_id: z.number().int().positive(),
      quantity: z.number().int().positive(),
    })
  )
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> } // params это Promise
) {
  try {
    // Используем await для получения параметров
    const { shopId } = await params;
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

    const shopIdNum = Number(shopId);
    if (!shopIdNum) {
      return NextResponse.json({ message: "Неверный ID магазина" }, { status: 400 });
    }

    const json = await req.json();
    const parsed = checkStockSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Неверные данные", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const variantIds = parsed.data.items.map(i => BigInt(i.product_variant_id));

    // Получаем текущие остатки
    const stockItems = await prisma.shop_stock.findMany({
      where: {
        shop_id: BigInt(shopIdNum),
        product_variant_id: { in: variantIds }
      },
      select: {
        product_variant_id: true,
        quantity: true
      }
    });

    const stockMap = new Map<bigint, number>();
    for (const item of stockItems) {
      stockMap.set(item.product_variant_id, item.quantity);
    }

    // Проверяем достаточность
    const errors = [];
    for (const item of parsed.data.items) {
      const variantId = BigInt(item.product_variant_id);
      const available = stockMap.get(variantId) || 0;
      if (available < item.quantity) {
        errors.push({
          product_variant_id: item.product_variant_id,
          available,
          requested: item.quantity
        });
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({
        message: "Недостаточно товара на складе",
        errors
      }, { status: 400 });
    }

    return NextResponse.json({ 
      message: "Достаточно товара на складе",
      valid: true 
    });

  } catch (error) {
    console.error("Stock check error:", error);
    return NextResponse.json(
      { message: "Ошибка проверки склада" },
      { status: 500 }
    );
  }
}