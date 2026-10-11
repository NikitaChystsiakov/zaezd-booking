import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Role } from '@prisma/client'
import { verifyJwt, getCookieName, signJwt } from './jwt'

export type Session = {
  userId: string
  propertyId: string
  role: Role
}

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

/** Для страниц и server actions админки: без сессии — на вход */
export async function requireSession(): Promise<Session> {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

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
