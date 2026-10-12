import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import type { Role } from '@prisma/client'

const cookieName = 'zaezd_session'

// Секрет читаем при первом обращении, а не при импорте: сборка не должна падать без переменных окружения.
// В продакшене запасного значения нет — иначе забытая переменная позволила бы подделать любую сессию.
let secret: Uint8Array | undefined
function getSecret(): Uint8Array {
  if (secret) return secret
  const value = process.env.JWT_SECRET
  if (process.env.NODE_ENV === 'production') {
    if (!value || value.length < 32 || value.startsWith('change-me')) {
      throw new Error('JWT_SECRET не задан или слишком короткий: нужна случайная строка от 32 символов')
    }
  }
  secret = new TextEncoder().encode(value || 'dev-secret')
  return secret
}

export type AppJwtPayload = JWTPayload & {
  sub: string
  propertyId: string
  role: Role
}

export function getCookieName(): string {
  return cookieName
}

export async function signJwt(payload: AppJwtPayload, exp = '7d'): Promise<string> {
  return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(exp).sign(getSecret())
}

export async function verifyJwt(token: string): Promise<AppJwtPayload> {
  const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] })
  return payload as AppJwtPayload
}
