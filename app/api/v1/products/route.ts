// app/api/v1/products/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonSafe } from '@/lib/bigint'
import type { ProductForUserDto } from '@/types/product'

export async function GET() {
  try {
    const products = await prisma.products.findMany({
      where: {
        active: true,                  
      },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        width_mm: true,
        height_mm: true,
        depth_mm: true,
        base_price: true,
        image_path: true,               
        variants: {
          where: {
            active: true,              
          },
          select: {
            id: true,
            sku: true,
            price: true,
            material: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { id: 'desc' },
    })

    const normalized = jsonSafe(products) as ProductForUserDto[] | any[]

    const withActiveVariants = (normalized as any[]).filter(
      (p) => Array.isArray(p.variants) && p.variants.length > 0
    )

    return NextResponse.json(withActiveVariants)
  } catch (err) {
    console.error('products fetch error', err)
    return NextResponse.json(
      { message: 'Ошибка при загрузке товаров', error: String(err) },
      { status: 500 }
    )
  }
}
