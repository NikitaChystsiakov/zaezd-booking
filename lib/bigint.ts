import { Prisma } from '@prisma/client'
import type { Role } from '@prisma/client';


export function jsonSafe(input: any): any {
  return JSON.parse(
    JSON.stringify(input, (_, v) => {
      if (typeof v === 'bigint') return v.toString()

      // Prisma.Decimal
      if (v instanceof Prisma.Decimal) {
        return v.toNumber()
      }

      // Старый Decimal / Decimal.js
      if (v && typeof v === 'object') {
        if (typeof (v as any).toNumber === 'function') return (v as any).toNumber()
        if (typeof (v as any).toFixed === 'function') return Number((v as any).toFixed(10))
        if (v instanceof Date) return v.toISOString()
      }

      return v
    })
  )
}

export type PlainUser = {
  id: string; 
  role: Role;
  email: string;
  first_name: string | null;
  second_name: string | null;
  last_name: string | null;
  phone: string | null;
  active: boolean;
  created_at: string; // ISO-строка
};

export function toPlainUser(u: any): PlainUser | null {
  if (!u) return null;
  return {
    id: typeof u.id === 'bigint' ? u.id.toString() : String(u.id),
    role: u.role as Role,
    email: u.email,
    first_name: u.first_name ?? null,
    second_name: u.second_name ?? null,
    last_name: u.last_name ?? null,
    phone: u.phone ?? null,
    active: Boolean(u.active),
    created_at: u.created_at instanceof Date ? u.created_at.toISOString() : String(u.created_at),
  };
}
