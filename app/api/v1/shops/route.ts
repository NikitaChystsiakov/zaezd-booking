
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const shops = await prisma.shops.findMany({
      where: { active: true },
      select: {
        id: true,
        city: true,
        street: true,
      },
      orderBy: [
        { city: 'asc' },
        { street: 'asc' },
      ],
    })

    const normalized = shops.map((s) => ({
      id: Number(s.id),
      city: s.city,
      street: s.street,
    }))

    return NextResponse.json(normalized, { status: 200 })
  } catch (err) {
    console.error('shops fetch error', err)
    return NextResponse.json(
      { message: 'Ошибка при загрузке магазинов' },
      { status: 500 }
    )
  }
}
