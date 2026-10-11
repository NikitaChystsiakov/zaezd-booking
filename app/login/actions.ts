'use server'

import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { endSession, startSession } from '@/lib/session'

export async function login(_: string | null, form: FormData): Promise<string | null> {
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const password = String(form.get('password') ?? '')
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return 'Неверная почта или пароль'
  await startSession(user)
  redirect('/admin')
}

export async function logout() {
  await endSession()
  redirect('/login')
}
