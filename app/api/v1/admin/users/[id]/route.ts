import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Role } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { jsonSafe } from '@/lib/bigint'

export const runtime = 'nodejs'

const patchUserSchema = z.object({
  email: z.string().trim().email().optional(),
  password: z.string().min(6).optional(), 
  role: z.nativeEnum(Role).optional(),
  active: z.coerce.boolean().optional(),

  first_name: z.string().trim().optional().nullable(),
  second_name: z.string().trim().optional().nullable(),
  last_name: z.string().trim().optional().nullable(),
  phone: z.string().trim()
    .optional()
    .nullable()
    .refine(
      (val) => !val || val === '' || /^\+375(29|33|44|25|17|16|21|22|23|24|15|99)\d{7}$/.test(val),
      {
        message: 'Номер телефона должен быть в формате +375XXXXXXXXX'
      }
    ),
})

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const userId = Number(id)
    if (!Number.isFinite(userId)) {
      return NextResponse.json({ message: 'Некорректный ID' }, { status: 400 })
    }

    const body = await req.json()
    const parsed = patchUserSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? 'Неверные данные' },
        { status: 400 }
      )
    }

    const d = parsed.data

    // Дополнительная проверка на минимальную длину номера
    if (d.phone && d.phone.trim() !== '') {
      const phone = d.phone.trim()
      
      // Проверка что номер начинается с +375
      if (!phone.startsWith('+375')) {
        return NextResponse.json(
          { message: 'Номер телефона должен начинаться с +375' },
          { status: 400 }
        )
      }
      
      // Проверка общей длины (13 символов: +375 + 9 цифр)
      if (phone.length !== 13) {
        return NextResponse.json(
          { message: 'Номер телефона должен содержать ровно 13 символов (+375XXXXXXXXX)' },
          { status: 400 }
        )
      }
      
      // Проверка что после +375 только цифры
      const digitsOnly = phone.substring(4)
      if (!/^\d{9}$/.test(digitsOnly)) {
        return NextResponse.json(
          { message: 'После +375 должны быть только цифры' },
          { status: 400 }
        )
      }
      
      // Проверка кода оператора (первые 2 цифры после +375)
      const operatorCode = phone.substring(4, 6)
      const validOperators = ['29', '33', '44', '25', '17', '16', '21', '22', '23', '24', '15', '99']
      if (!validOperators.includes(operatorCode)) {
        return NextResponse.json(
          { message: 'Неверный код оператора. Допустимые: ' + validOperators.join(', ') },
          { status: 400 }
        )
      }
    }

    const updateData: any = {
      ...(d.email !== undefined ? { email: d.email } : {}),
      ...(d.role !== undefined ? { role: d.role } : {}),
      ...(typeof d.active === 'boolean' ? { active: d.active } : {}),

      ...(d.first_name !== undefined ? { first_name: d.first_name?.trim() || null } : {}),
      ...(d.second_name !== undefined ? { second_name: d.second_name?.trim() || null } : {}),
      ...(d.last_name !== undefined ? { last_name: d.last_name?.trim() || null } : {}),
      ...(d.phone !== undefined ? { phone: d.phone?.trim() || null } : {}),
    }

    if (d.password) {
      updateData.password_hash = await bcrypt.hash(d.password, 10)
    }

    const updated = await prisma.users.update({
      where: { id: BigInt(userId) },
      data: updateData,
      select: {
        id: true,
        email: true,
        first_name: true,
        second_name: true,
        last_name: true,
        phone: true,
        role: true,
        active: true,
        created_at: true,
      },
    })

    return NextResponse.json({ user: jsonSafe(updated) }, { status: 200 })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return NextResponse.json({ message: 'Email или телефон уже заняты' }, { status: 409 })
    }
    console.error('user patch error', err)
    return NextResponse.json({ message: 'Ошибка обновления пользователя' }, { status: 500 })
  }
}