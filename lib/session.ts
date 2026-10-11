import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Role } from '@prisma/client'
import { prisma } from './prisma'
import { verifyJwt, getCookieName, signJwt } from './jwt'

export type Session = {
  userId: string
  propertyId: string
  role: Role
}

/** Подпись токена верна — но пользователь мог быть удалён. Это проверяет requireSession. */
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(getCookieName())?.value
  if (!token) return null
  try {
    const p = await verifyJwt(token)
    return { userId: p.sub, propertyId: p.propertyId, role: p.role }
  } catch {
    return null
  }
}

/**
 * Для страниц и server actions админки. Сверяет сессию с базой: пользователь существует
 * и всё ещё относится к этой усадьбе. Роль берём из базы, а не из токена — чтобы смена роли
 * действовала сразу. Один запрос к БД на запрос страницы (cache).
 */
export const requireSession = cache(async (): Promise<Session> => {
  const session = await getSession()
  if (!session) redirect('/login')
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, propertyId: true, role: true } })
  // Устаревший вход (пользователь удалён или база пересоздана) — сбрасываем куку и на вход
  if (!user || user.propertyId !== session.propertyId) redirect('/logout')
  return { userId: user.id, propertyId: user.propertyId, role: user.role }
})

export async function startSession(user: { id: string; propertyId: string; role: Role }) {
  const token = await signJwt({ sub: user.id, propertyId: user.propertyId, role: user.role })
  ;(await cookies()).set(getCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
}

export async function endSession() {
  ;(await cookies()).delete(getCookieName())
}
