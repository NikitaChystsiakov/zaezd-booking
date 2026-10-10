// app/api/v1/shops/[shopId]/stock/route.ts
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

export async function GET(
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

    // Получаем остатки со склада
    const stock = await prisma.shop_stock.findMany({
      where: {
        shop_id: BigInt(shopIdNum),
      },
      select: {
        product_variant_id: true,
        quantity: true,
      },
    });

    const formattedStock = stock.map(item => ({
      product_variant_id: Number(item.product_variant_id),
      quantity: item.quantity,
    }));

    return NextResponse.json({ 
      shopId: shopIdNum,
      stock: formattedStock 
    });

  } catch (error) {
    console.error("Get stock error:", error);
    return NextResponse.json(
      { message: "Ошибка получения остатков" },
      { status: 500 }
    );
  }
}