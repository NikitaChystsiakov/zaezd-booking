import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import type { Role } from '@prisma/client'

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret')
const cookieName = 'gurtom_session'

export type AppJwtPayload = JWTPayload & {
  sub: string
  propertyId: string
  role: Role
}

export function getCookieName(): string {
  return cookieName
}

export async function signJwt(payload: AppJwtPayload, exp = '7d'): Promise<string> {
  return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(exp).sign(secret)
}

export async function verifyJwt(token: string): Promise<AppJwtPayload> {
  const { payload } = await jwtVerify(token, secret)
  return payload as AppJwtPayload
}
