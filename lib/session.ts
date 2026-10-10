import 'server-only';
import { cookies } from 'next/headers';
import { verifyJwt, getCookieName, type AppJwtPayload } from './jwt';
import type { Role } from '@prisma/client';


export type Session = {
  userId: string;
  role: Role;
  email: string;
};

export async function getSession(): Promise<Session | null> {
  const store = await cookies(); 
  const token = store.get(getCookieName())?.value;
  if (!token) return null;

  try {
    const p = await verifyJwt<AppJwtPayload>(token);
    return { userId: String(p.sub), role: p.role, email: p.email };
  } catch {
    return null;
  }
}
