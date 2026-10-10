import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createProductSchema } from '@/server/validations/product'
import { jsonSafe } from '@/lib/bigint'
import fs from 'fs/promises'
import path from 'path'

export async function POST(req: Request) {
  try {
    // получаем данные формы
    const formData = await req.formData()
    const raw = Object.fromEntries(formData.entries())

    const materials = raw.materials ? JSON.parse(raw.materials as string) : []
    const imageFile = formData.get('image') as File | null

    // валидируем через Zod
    const parsed = createProductSchema.parse({
      ...raw,
      width_mm: Number(raw.width_mm),
      height_mm: Number(raw.height_mm),
      depth_mm: Number(raw.depth_mm),
      base_price: Number(raw.base_price),
      materials,
      image: imageFile ?? null,
    })

    const { name, description, category, width_mm, height_mm, depth_mm, base_price } = parsed

    // --- ПРОВЕРКА НА ДУБЛИКАТ НАЗВАНИЯ ---
    const existingProduct = await prisma.products.findFirst({
      where: {
        name: name
      }
    })

    if (existingProduct) {
      return NextResponse.json(
        { message: 'Товар с таким названием уже существует' },
        { status: 400 }
      )
    }

    // сохраняем изображение 
    let image_path: string | null = null
    if (imageFile) {
      const bytes = Buffer.from(await imageFile.arrayBuffer())
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'products')
      await fs.mkdir(uploadDir, { recursive: true })
      const fileName = `${Date.now()}-${imageFile.name.replace(/\s+/g, '_')}`
      await fs.writeFile(path.join(uploadDir, fileName), bytes)
      image_path = `/uploads/products/${fileName}`
    }

    // создаём сам товар 
    const product = await prisma.products.create({
      data: {
        name,
        description,
        category,
        width_mm,
        height_mm,
        depth_mm,
        base_price,
        image_path,
        active: true,
      },
    })

    const volume_mm3 = width_mm * height_mm * depth_mm
    const materialIds = materials.map((m: any) => BigInt(m.id))

    const dbMaterials = await prisma.materials.findMany({
      where: { id: { in: materialIds } },
      select: { id: true, price_per_mm3: true },
    })

    const variants = dbMaterials.map((m) => {
      const materialExtra = volume_mm3 * Number(m.price_per_mm3)
      const totalPrice = base_price + materialExtra

      return {
        product_id: product.id,
        material_id: m.id,
        price: totalPrice,
        active: true,
        sku: `${product.id}-${m.id}`,
      }
    })

    if (variants.length > 0) {
      await prisma.product_variants.createMany({ data: variants })
    }

    return NextResponse.json(
      jsonSafe({
        message: 'Товар создан успешно',
        product,
        variants,
      }),
      { status: 201 }
    )
  } catch (e: any) {
    console.error('create product error:', e)

    if (e?.issues) {
      return NextResponse.json(
        { message: e.issues[0]?.message ?? 'Некорректные данные' },
        { status: 400 }
      )
    }

    return NextResponse.json({ message: 'Server error' }, { status: 500 })
  }
}