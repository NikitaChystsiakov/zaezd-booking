import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonSafe } from '@/lib/bigint'
import { z } from 'zod'

const patchSchema = z.object({
  name: z.string().trim().min(1, 'Название обязательно').optional(),
  color: z.string().trim().min(1, 'Цвет обязателен').optional(),
  price_per_mm3: z.union([z.string(), z.number()])
    .transform(val => {
      if (val === undefined) return undefined
      // Преобразуем в число
      const num = typeof val === 'string' ? parseFloat(val) : val
      // Округляем до 4 знаков после запятой
      return Math.round(num * 10000) / 10000
    })
    .refine(val => val === undefined || val >= 0, 'Цена не может быть отрицательной')
    .refine(val => val === undefined || val <= 0.0099, 'Максимальная цена за мм³: 0.0099')
    .optional(),
  active: z.boolean().optional(),
})

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const materialId = Number(id)
    
    if (!Number.isFinite(materialId)) {
      return NextResponse.json({ message: 'Некорректный ID' }, { status: 400 })
    }

    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? 'Неверные данные' },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Проверка на существующий материал (только если меняется название)
    if (data.name !== undefined) {
      const existingMaterial = await prisma.materials.findFirst({
        where: {
          name: data.name,
          id: {
            not: BigInt(materialId)
          }
        }
      })

      if (existingMaterial) {
        return NextResponse.json(
          { message: 'Материал с таким названием уже существует' },
          { status: 409 }
        )
      }
    }

    // Дополнительная проверка цены (если меняется)
    if (data.price_per_mm3 !== undefined && data.price_per_mm3 > 0.0099) {
      return NextResponse.json(
        { message: 'Максимальная цена за мм³: 0.0099' },
        { status: 400 }
      )
    }

    const updateData: any = {}
    
    if (data.name !== undefined) updateData.name = data.name
    if (data.color !== undefined) updateData.color = data.color
    if (data.price_per_mm3 !== undefined) updateData.price_per_mm3 = data.price_per_mm3 as any
    if (data.active !== undefined) updateData.active = data.active

    const updated = await prisma.materials.update({
      where: { id: BigInt(materialId) },
      data: updateData,
      select: { id: true, name: true, color: true, price_per_mm3: true, active: true },
    })

    return NextResponse.json({ material: jsonSafe(updated) })
  } catch (err: any) {
    console.error('material update error', err)
    
    if (err?.code === 'P2002') {
      return NextResponse.json(
        { message: 'Материал с таким названием уже существует' },
        { status: 409 }
      )
    }
    
    if (err?.code === 'P2025') {
      return NextResponse.json(
        { message: 'Материал не найден' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ message: 'Ошибка при обновлении материала' }, { status: 500 })
  }
}