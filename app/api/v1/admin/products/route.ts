import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const products = await prisma.products.findMany({
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
        active: true,
        variants: {
          select: {
            id: true,
            price: true,
            sku: true,
            active: true,
            material: { select: { name: true, price_per_mm3: true } },
          },
        },
      },
      orderBy: { id: 'desc' },
    })

    const normalized = products.map(p => ({
      id: Number(p.id),
      name: p.name,
      description: p.description,
      category: p.category,
      width_mm: Number(p.width_mm),
      height_mm: Number(p.height_mm),
      depth_mm: Number(p.depth_mm),
      base_price: Number(p.base_price ?? 0),   
      image_path: p.image_path ?? null,        
      active: Boolean(p.active),
      variants: p.variants.map(v => ({
        id: Number(v.id),
        price: Number(v.price),
        sku: v.sku,
        active: Boolean(v.active),
        material: {
          name: v.material.name,
          price_per_mm3: Number(v.material.price_per_mm3),
        },
      })),
    }))

    return NextResponse.json(normalized)
  } catch (err) {
    console.error('products fetch error', err)
    return NextResponse.json(
      { message: 'Ошибка при загрузке товаров' },
      { status: 500 },
    )
  }
}