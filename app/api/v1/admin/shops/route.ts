import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const runtime = 'nodejs'

const createShopSchema = z.object({
  city: z.string().trim().min(1, 'Город обязателен'),
  street: z.string().trim().min(1, 'Адрес обязателен'),
  active: z.coerce.boolean().optional(),
})

export async function GET() {
  try {
    const shops = await prisma.shops.findMany({
      select: { id: true, city: true, street: true, active: true },
      orderBy: [{ city: 'asc' }, { street: 'asc' }],
    })

    return NextResponse.json(
      shops.map(s => ({
        id: Number(s.id),
        city: s.city,
        street: s.street,
        active: Boolean(s.active),
      })),
      { status: 200 }
    )
  } catch (err) {
    console.error('admin shops fetch error', err)
    return NextResponse.json({ message: 'Ошибка при загрузке магазинов' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = createShopSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? 'Некорректные данные' },
        { status: 400 }
      )
    }

    const created = await prisma.shops.create({
      data: {
        city: parsed.data.city,
        street: parsed.data.street,
        ...(typeof parsed.data.active === 'boolean' ? { active: parsed.data.active } : {}),
      },
      select: { id: true, city: true, street: true, active: true },
    })

    return NextResponse.json(
      { shop: { id: Number(created.id), city: created.city, street: created.street, active: created.active } },
      { status: 201 }
    )
  } catch (err) {
    console.error('admin shop create error', err)
    return NextResponse.json({ message: 'Ошибка при создании магазина' }, { status: 500 })
  }
}
