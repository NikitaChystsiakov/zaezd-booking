import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const runtime = 'nodejs'

const patchSchema = z.object({
  city: z.string().trim().min(1).optional(),
  street: z.string().trim().min(1).optional(),
  active: z.coerce.boolean().optional(),
})

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const shopId = Number(id)
    if (!Number.isFinite(shopId)) {
      return NextResponse.json({ message: 'Некорректный ID' }, { status: 400 })
    }

    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? 'Некорректные данные' },
        { status: 400 }
      )
    }

    const data = parsed.data
    const updated = await prisma.shops.update({
      where: { id: BigInt(shopId) },
      data: {
        ...(data.city !== undefined ? { city: data.city } : {}),
        ...(data.street !== undefined ? { street: data.street } : {}),
        ...(typeof data.active === 'boolean' ? { active: data.active } : {}),
      },
      select: { id: true, city: true, street: true, active: true },
    })

    return NextResponse.json(
      { shop: { id: Number(updated.id), city: updated.city, street: updated.street, active: updated.active } },
      { status: 200 }
    )
  } catch (err: any) {
    console.error('admin shop patch error', err)
    return NextResponse.json({ message: 'Ошибка обновления', details: err?.message }, { status: 500 })
  }
}
