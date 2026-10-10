import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { jsonSafe } from '@/lib/bigint'

const qsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional().default(''),
  status: z
    .enum([
      'created',
      'in_production',
      'ready_to_ship',
      'in_transit',
      'delivered',
      'cancelled',
    ])
    .optional(),
  delivery_type: z.enum(['pickup', 'home_delivery']).optional(),
})

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const parsed = qsSchema.parse({
      page: url.searchParams.get('page') ?? undefined,
      pageSize: url.searchParams.get('pageSize') ?? undefined,
      q: url.searchParams.get('q') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
      delivery_type: url.searchParams.get('delivery_type') ?? undefined,
    })

    const { page, pageSize, q, status, delivery_type } = parsed

    // where
    const where: any = {}
    if (status) where.status = status
    if (delivery_type) where.delivery_type = delivery_type

    if (q) {
      const or: any[] = [
        { customer_phone: { contains: q } },
        { customer_email: { contains: q } },
        { customer_name: { contains: q } },
        { customer_second_name: { contains: q } },
        { customer_last_name: { contains: q } },
      ]

      // если q похож на число — ищем по ID
      const numeric = q.replace(/\s+/g, '')
      if (/^\d+$/.test(numeric)) {
        try {
          or.unshift({ id: BigInt(numeric) })
        } catch {}
      }

      where.OR = or
    }

    const [total, rows] = await Promise.all([
      prisma.orders.count({ where }),
      prisma.orders.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          address: true,
          shop: { select: { id: true, city: true, street: true } },
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
      }),
    ])

    const orders = rows.map((o) => ({
      id: Number(o.id),
      created_at: o.created_at.toISOString(),
      customer_name: o.customer_name,
      customer_second_name: o.customer_second_name,
      customer_last_name: o.customer_last_name,
      customer_phone: o.customer_phone,
      customer_email: o.customer_email,
      delivery_type: o.delivery_type,
      status: o.status,
      note: o.note,
      total_amount: Number(o.total_amount),
      address: o.address
        ? {
            city: o.address.city,
            street: o.address.street,
            house: o.address.house,
            apartment: o.address.apartment,
            entrance: o.address.entrance,
            floor: o.address.floor,
          }
        : null,
      shop: o.shop
        ? { id: Number(o.shop.id), city: o.shop.city, street: o.shop.street }
        : null,
      items: o.items.map((it) => ({
        id: Number(it.id),
        quantity: it.quantity,
        unit_price: Number(it.unit_price),
        line_total: Number(it.line_total),
        productVariant: it.productVariant
          ? {
              sku: it.productVariant.sku,
              product: it.productVariant.product
                ? { name: it.productVariant.product.name }
                : undefined,
              material: it.productVariant.material
                ? { name: it.productVariant.material.name }
                : undefined,
            }
          : null,
      })),
    }))

    return NextResponse.json({
        page,
        pageSize,
        total,
        orders,
      },
      { status: 200 }
    )

  } catch (err: any) {
    console.error('admin orders fetch error', err)
    return NextResponse.json(
      { message: 'Ошибка при загрузке заказов', details: err?.message },
      { status: 500 }
    )
  }
}
