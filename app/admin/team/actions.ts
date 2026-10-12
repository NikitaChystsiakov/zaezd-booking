'use server'

import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Prisma, Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/session'
import { ROLE_RANK } from '@/lib/permissions'

// Управление командой усадьбы. Доступно только с правом team:manage (владелец).
// Правила: в усадьбе всегда остаётся хотя бы один владелец; роль выше своей выдать нельзя;
// чужих пользователей не видно и не тронуть.

export type TeamResult = { ok: true; password?: string } | { ok: false; error: string }

const roleSchema = z.enum(['owner', 'admin', 'staff'])

const inviteSchema = z.object({
  name: z.string().trim().min(2, 'Как зовут сотрудника?').max(60),
  email: z.string().trim().max(120).pipe(z.email('Проверьте почту')),
  role: roleSchema,
})

export type InviteInput = z.infer<typeof inviteSchema>

/** Временный пароль: показывается владельцу один раз, сотрудник потом меняет его сам */
function temporaryPassword(): string {
  return randomBytes(9).toString('base64url')
}

const refresh = () => revalidatePath('/admin/team')

export async function inviteUser(input: InviteInput): Promise<TeamResult> {
  const session = await requirePermission('team:manage')
  const parsed = inviteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const { name, role } = parsed.data
  const email = parsed.data.email.toLowerCase()
  if (ROLE_RANK[role] > ROLE_RANK[session.role]) return { ok: false, error: 'Нельзя выдать роль выше своей' }
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) return { ok: false, error: 'Эта почта уже зарегистрирована' }

  const password = temporaryPassword()
  await prisma.user.create({ data: { propertyId: session.propertyId, email, name, role, passwordHash: await bcrypt.hash(password, 10) } })
  refresh()
  return { ok: true, password }
}

/** Работаем только с пользователями своей усадьбы; блокировка не даёт двум владельцам одновременно «оставить» усадьбу без владельца */
async function withTeam<T>(propertyId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'team:' + propertyId}))`
    return fn(tx)
  })
}

export async function changeRole(userId: string, role: Role): Promise<TeamResult> {
  const session = await requirePermission('team:manage')
  const next = roleSchema.safeParse(role)
  if (!next.success) return { ok: false, error: 'Неизвестная роль' }
  if (ROLE_RANK[next.data] > ROLE_RANK[session.role]) return { ok: false, error: 'Нельзя выдать роль выше своей' }

  const result = await withTeam(session.propertyId, async (tx): Promise<TeamResult> => {
    const target = await tx.user.findFirst({ where: { id: userId, propertyId: session.propertyId } })
    if (!target) return { ok: false, error: 'Пользователь не найден' }
    if (target.role === 'owner' && next.data !== 'owner' && (await tx.user.count({ where: { propertyId: session.propertyId, role: 'owner' } })) <= 1) {
      return { ok: false, error: 'В усадьбе должен остаться хотя бы один владелец' }
    }
    await tx.user.update({ where: { id: target.id }, data: { role: next.data } })
    return { ok: true }
  })
  refresh()
  return result
}

export async function removeUser(userId: string): Promise<TeamResult> {
  const session = await requirePermission('team:manage')
  if (userId === session.userId) return { ok: false, error: 'Себя удалить нельзя — попросите другого владельца' }

  const result = await withTeam(session.propertyId, async (tx): Promise<TeamResult> => {
    const target = await tx.user.findFirst({ where: { id: userId, propertyId: session.propertyId } })
    if (!target) return { ok: false, error: 'Пользователь не найден' }
    if (target.role === 'owner' && (await tx.user.count({ where: { propertyId: session.propertyId, role: 'owner' } })) <= 1) {
      return { ok: false, error: 'В усадьбе должен остаться хотя бы один владелец' }
    }
    await tx.user.delete({ where: { id: target.id } })
    return { ok: true }
  })
  refresh()
  return result
}

/** Забыл пароль: владелец выдаёт новый временный. Старый перестаёт работать сразу. */
export async function resetPassword(userId: string): Promise<TeamResult> {
  const session = await requirePermission('team:manage')
  const target = await prisma.user.findFirst({ where: { id: userId, propertyId: session.propertyId } })
  if (!target) return { ok: false, error: 'Пользователь не найден' }
  const password = temporaryPassword()
  await prisma.user.update({ where: { id: target.id }, data: { passwordHash: await bcrypt.hash(password, 10) } })
  return { ok: true, password }
}
