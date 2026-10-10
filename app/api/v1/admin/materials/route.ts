import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonSafe } from '@/lib/bigint'
import { z } from 'zod'

export async function GET() {
  try {
    const materials = await prisma.materials.findMany({
      select: { id: true, name: true, color: true, price_per_mm3: true, active: true },
      orderBy: { id: 'asc' },
    })

    return NextResponse.json(jsonSafe(materials))
  } catch (err) {
    console.error('materials fetch error', err)
    return NextResponse.json({ message: 'Ошибка при загрузке материалов' }, { status: 500 })
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1, 'Название обязательно'),
  color: z.string().trim().min(1, 'Цвет обязателен'),
  price_per_mm3: z.union([z.string(), z.number()])
    .transform(val => {
      // Преобразуем в число
      const num = typeof val === 'string' ? parseFloat(val) : val
      // Округляем до 4 знаков после запятой
      return Math.round(num * 10000) / 10000
    })
    .refine(val => val >= 0, 'Цена не может быть отрицательной')
    .refine(val => val <= 0.0099, 'Максимальная цена за мм³: 0.0099'),
  active: z.boolean().optional(),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? 'Неверные данные' },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Проверка на существующий материал
    const existingMaterial = await prisma.materials.findFirst({
      where: {
        name: data.name
      }
    })

    if (existingMaterial) {
      return NextResponse.json(
        { message: 'Материал с таким названием уже существует' },
        { status: 409 }
      )
    }

    // Дополнительная проверка цены 
    if (data.price_per_mm3 > 0.0099) {
      return NextResponse.json(
        { message: 'Максимальная цена за см: 0.0099' },
        { status: 400 }
      )
    }

    const material = await prisma.materials.create({
      data: {
        name: data.name,
        color: data.color,
        price_per_mm3: data.price_per_mm3 as any,
        active: data.active ?? true,
      },
      select: { id: true, name: true, color: true, price_per_mm3: true, active: true },
    })

    return NextResponse.json({ material: jsonSafe(material) }, { status: 201 })
  } catch (err: any) {
    console.error('material create error', err)
    
    if (err?.code === 'P2002') {
      return NextResponse.json(
        { message: 'Материал с таким названием уже существует' },
        { status: 409 }
      )
    }
    
    return NextResponse.json({ message: 'Ошибка при создании материала' }, { status: 500 })
  }
}