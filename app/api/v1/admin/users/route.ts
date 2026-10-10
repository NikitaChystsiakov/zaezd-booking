import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Role } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { jsonSafe } from '@/lib/bigint'

export const runtime = 'nodejs'

const createUserSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6, 'Пароль минимум 6 символов'),
  role: z.nativeEnum(Role),
  active: z.coerce.boolean().optional(),

  first_name: z.string().trim().min(3, 'Имя должно содержать минимум 3 символа').optional().nullable(),
  second_name: z.string().trim().min(4, 'Отчество должно содержать минимум 4 символа').optional().nullable(),
  last_name: z.string().trim().min(4, 'Фамилия должна содержать минимум 4 символа').optional().nullable(),
  phone: z.string().trim()
    .optional()
    .nullable()
    .refine(
      (val) => !val || val === '' || /^\+375(29|33|44|25|17|16|21|22|23|24|15|99)\d{7}$/.test(val),
      {
        message: 'Номер телефона должен быть в формате +375XXXXXXXXX (белорусский оператор)'
      }
    ),
})

export async function GET() {
  try {
    const users = await prisma.users.findMany({
      orderBy: { id: 'asc' },
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

    return NextResponse.json(jsonSafe(users), { status: 200 })
  } catch (err) {
    console.error('users fetch error', err)
    return NextResponse.json({ message: 'Ошибка при загрузке пользователей' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = createUserSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? 'Неверные данные' },
        { status: 400 }
      )
    }

    const d = parsed.data

    // Проверка на существующий email
    const existingUserWithEmail = await prisma.users.findFirst({
      where: {
        email: d.email
      }
    })

    if (existingUserWithEmail) {
      return NextResponse.json(
        { message: 'Пользователь с таким email уже существует' },
        { status: 409 }
      )
    }

    // Проверка номера телефона
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

      // Проверка на уникальность телефона
      const existingUserWithPhone = await prisma.users.findFirst({
        where: {
          phone: phone
        }
      })

      if (existingUserWithPhone) {
        return NextResponse.json(
          { message: 'Этот номер телефона уже занят другим пользователем' },
          { status: 409 }
        )
      }
    }

    const password_hash = await bcrypt.hash(d.password, 10)

    const created = await prisma.users.create({
      data: {
        email: d.email,
        password_hash,
        role: d.role,
        active: typeof d.active === 'boolean' ? d.active : true,

        first_name: d.first_name?.trim() || null,
        second_name: d.second_name?.trim() || null,
        last_name: d.last_name?.trim() || null,
        phone: d.phone?.trim() || null,
      },
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

    return NextResponse.json({ user: jsonSafe(created) }, { status: 201 })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      // Резервная проверка на случай если что-то упустили
      if (err.meta?.target?.includes('email')) {
        return NextResponse.json(
          { message: 'Email уже занят' },
          { status: 409 }
        )
      }
      if (err.meta?.target?.includes('phone')) {
        return NextResponse.json(
          { message: 'Номер телефона уже занят' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { message: 'Email или телефон уже заняты' },
        { status: 409 }
      )
    }
    console.error('user create error', err)
    return NextResponse.json({ message: 'Ошибка при создании пользователя' }, { status: 500 })
  }
}