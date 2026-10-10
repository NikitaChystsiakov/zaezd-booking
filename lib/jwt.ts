import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { Role } from '@prisma/client';

const secret  = new TextEncoder().encode(process.env.JWT_SECRET || 'devsecret');
const expires = process.env.JWT_EXPIRES_IN || '7d';
const cookieName = process.env.AUTH_COOKIE || 'auth_token';

export type AppJwtPayload = JWTPayload & {
  sub: string;     
  email: string;
  role: Role;      
};

export function getCookieName(): string {
  return cookieName;
}

export async function signJwt(payload: AppJwtPayload, exp: string = expires): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(secret);
}

export async function verifyJwt<T = AppJwtPayload>(token: string): Promise<T> {
  const { payload } = await jwtVerify(token, secret);
  return payload as T;
}
