import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { verifyJwt } from '@/lib/jwt'
import { jsonSafe } from '@/lib/bigint'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    const token = (await cookies()).get('auth_token')?.value
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const payload: any = await verifyJwt(token)
    const userId = BigInt(payload.sub)

    const rows = await prisma.orders.findMany({
      where: { created_by: userId },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        created_at: true,
        status: true,
        total_amount: true,
        stripe_session_id: true,
        items: {
          select: {
            id: true,
            quantity: true,
            productVariant: {
              select: {
                sku: true,
                product: { select: { name: true } },
                material: { select: { name: true } },
              },
            },
          },
        },
      },
    })

    const orders = rows.map((o) => ({
      id: Number(o.id),
      created_at: o.created_at.toISOString(),
      status: o.status,
      total: Number(o.total_amount),
      items: (o.items ?? []).map((it) => ({
        id: Number(it.id),
        quantity: it.quantity,
        name: it.productVariant?.product?.name ?? 'Товар',
        materialName: it.productVariant?.material?.name ?? '',
        sku: it.productVariant?.sku ?? '',
      })),
      hasReceipt: Boolean(o.stripe_session_id),
      receiptUrl: o.stripe_session_id ? `/api/v1/orders/${Number(o.id)}/receipt` : null,
    }))

    return NextResponse.json(jsonSafe({ orders }), { status: 200 })
  } catch (e: any) {
    console.error('my orders error:', e)
    return NextResponse.json({ message: 'Ошибка загрузки заказов' }, { status: 500 })
  }
}
