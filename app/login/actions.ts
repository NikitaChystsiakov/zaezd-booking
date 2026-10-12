'use server'

import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { endSession, startSession } from '@/lib/session'
import { clientIp, rateLimit, resetRateLimit } from '@/lib/rateLimit'

const WINDOW = 15 * 60_000
const TOO_MANY = 'Слишком много попыток входа. Подождите 15 минут'

export async function login(_: string | null, form: FormData): Promise<string | null> {
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const password = String(form.get('password') ?? '')
  // Подбор пароля: ограничиваем и по адресу, и по почте (чужой адрес не должен давать перебирать один аккаунт бесконечно)
  if (!rateLimit(`login:ip:${await clientIp()}`, 30, WINDOW)) return TOO_MANY
  if (email && !rateLimit(`login:email:${email}`, 8, WINDOW)) return TOO_MANY
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return 'Неверная почта или пароль'
  resetRateLimit(`login:email:${email}`)
  await startSession(user)
  redirect('/admin')
}

export async function logout() {
  await endSession()
  redirect('/login')
}
