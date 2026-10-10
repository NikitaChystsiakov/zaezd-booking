import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonSafe } from '@/lib/bigint'

export const runtime = 'nodejs'

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const orderId = Number(id)
    if (!Number.isFinite(orderId)) {
      return NextResponse.json({ message: 'Некорректный id' }, { status: 400 })
    }

    const order = await prisma.orders.findUnique({
      where: { id: BigInt(orderId) },
      include: {
        shop: true,
        address: true,
        items: {
          include: {
            productVariant: {
              include: {
                product: true,
                material: true,
              },
            },
          },
        },
      },
    })

    if (!order) return NextResponse.json({ message: 'Заказ не найден' }, { status: 404 })
    return NextResponse.json(jsonSafe(order))
  } catch (err) {
    console.error('admin order details error', err)
    return NextResponse.json({ message: 'Ошибка при загрузке заказа' }, { status: 500 })
  }
}
