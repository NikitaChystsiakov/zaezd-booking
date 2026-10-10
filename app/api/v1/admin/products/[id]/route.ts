// app/api/v1/admin/products/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { promises as fs } from 'fs'
import path from 'path'
import { jsonSafe } from '@/lib/bigint'
import { ProductCategory } from '@prisma/client'

// --- схема для PATCH: active уже boolean ---
const updateProductSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  category: z.nativeEnum(ProductCategory).optional(),
  width_mm: z.coerce.number().int().positive().optional(),
  height_mm: z.coerce.number().int().positive().optional(),
  depth_mm: z.coerce.number().int().positive().optional(),
  base_price: z.coerce.number().nonnegative().optional(),
  active: z.boolean().optional(),
  variants: z
    .array(
      z.object({
        id: z.coerce.number().int().positive(),
        active: z.boolean(),
      })
    )
    .optional(),
})

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const productId = Number(id)
    if (!Number.isFinite(productId)) {
      return NextResponse.json({ message: 'Некорректный ID' }, { status: 400 })
    }

    const formData = await req.formData()

    // --- ЯВНО парсим active из строки ---
    const rawActive = formData.get('active')
    let active: boolean | undefined = undefined
    if (typeof rawActive === 'string') {
      if (rawActive === 'true') active = true
      else if (rawActive === 'false') active = false
    }

    const raw = {
      name: formData.get('name') ?? undefined,
      description: formData.get('description') ?? undefined,
      category: formData.get('category') ?? undefined,
      width_mm: formData.get('width_mm') ?? undefined,
      height_mm: formData.get('height_mm') ?? undefined,
      depth_mm: formData.get('depth_mm') ?? undefined,
      base_price: formData.get('base_price') ?? undefined,
      active, // уже boolean | undefined
      variants: formData.get('variants')
        ? JSON.parse(String(formData.get('variants')))
        : undefined,
    }

    const parsed = updateProductSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? 'Некорректные данные' },
        { status: 400 }
      )
    }

    const data = parsed.data

    // --- ПРОВЕРКА НА ДУБЛИКАТ НАЗВАНИЯ ---
    if (data.name) {
      const existingProduct = await prisma.products.findFirst({
        where: {
          name: data.name,
          id: {
            not: BigInt(productId) // исключаем текущий продукт
          }
        }
      })

      if (existingProduct) {
        return NextResponse.json(
          { message: 'Товар с таким названием уже существует' },
          { status: 400 }
        )
      }
    }

    // --- картинка (если передана) ---
    const file = formData.get('image') as File | null
    let image_path: string | undefined

    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const ext = path.extname(file.name || '.jpg').toLowerCase()
      const dir = path.join(process.cwd(), 'public', 'uploads', 'products')
      await fs.mkdir(dir, { recursive: true })
      const filename = `p_${productId}_${Date.now()}${ext}`
      await fs.writeFile(path.join(dir, filename), buffer)
      image_path = `/uploads/products/${filename}`
    }

    // --- формируем data для update ---
    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.category !== undefined) updateData.category = data.category
    if (data.width_mm !== undefined) updateData.width_mm = Number(data.width_mm)
    if (data.height_mm !== undefined) updateData.height_mm = Number(data.height_mm)
    if (data.depth_mm !== undefined) updateData.depth_mm = Number(data.depth_mm)
    if (data.base_price !== undefined) updateData.base_price = Number(data.base_price)
    if (data.active !== undefined) updateData.active = data.active
    if (image_path) updateData.image_path = image_path

    const updated = await prisma.products.update({
      where: { id: BigInt(productId) },
      data: updateData,
    })

    // --- обновляем активности конкретных вариантов (чекбоксы) ---
    if (Array.isArray(data.variants) && data.variants.length) {
      await Promise.all(
        data.variants.map(v =>
          prisma.product_variants.update({
            where: { id: BigInt(v.id) },
            data: { active: v.active },
          })
        )
      )
    }

    // --- если продукт выключен — выключаем ВСЕ его варианты ---
    if (data.active === false) {
      await prisma.product_variants.updateMany({
        where: { product_id: BigInt(productId) },
        data: { active: false },
      })
    }

    // --- пересчёт цен вариантов, если менялись габариты или base_price ---
    if (
      data.base_price !== undefined ||
      data.width_mm !== undefined ||
      data.height_mm !== undefined ||
      data.depth_mm !== undefined
    ) {
      const widthNum = Number(data.width_mm ?? updated.width_mm)
      const heightNum = Number(data.height_mm ?? updated.height_mm)
      const depthNum = Number(data.depth_mm ?? updated.depth_mm)
      const baseNum = Number(data.base_price ?? updated.base_price ?? 0)
      const volume = widthNum * heightNum * depthNum

      const variants = await prisma.product_variants.findMany({
        where: { product_id: BigInt(productId) },
        include: { material: { select: { price_per_mm3: true } } },
      })

      await Promise.all(
        variants.map(v => {
          const pricePerNum = Number(v.material.price_per_mm3)
          const newPrice = baseNum + volume * pricePerNum
          return prisma.product_variants.update({
            where: { id: v.id },
            data: { price: newPrice },
          })
        })
      )
    }

    const fresh = await prisma.products.findUnique({
      where: { id: BigInt(productId) },
      include: {
        variants: {
          include: { material: { select: { name: true, price_per_mm3: true } } },
        },
      },
    })

    if (!fresh) {
      return NextResponse.json({ message: 'Продукт не найден' }, { status: 404 })
    }

    return NextResponse.json(
      jsonSafe({ message: 'Товар обновлён', product: fresh }),
      { status: 200 }
    )
  } catch (e: any) {
    console.error('PATCH /products/:id error:', e)
    return NextResponse.json(
      { message: 'Ошибка сервера', details: e?.message ?? String(e) },
      { status: 500 }
    )
  }
}