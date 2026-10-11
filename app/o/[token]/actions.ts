'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { appUrl, escapeHtml, notifyTelegram } from '@/lib/notify'
import type { ProposalOption } from '@/lib/domain'

type Result = { ok: true; id?: string } | { ok: false; error: string }

async function load(token: string) {
  return prisma.proposal.findUnique({ where: { token }, include: { lead: { include: { property: true } } } })
}

export async function chooseOption(token: string, optionId: string): Promise<Result> {
  const p = await load(token)
  if (!p) return { ok: false, error: 'Предложение не найдено' }
  const option = (p.options as ProposalOption[]).find((o) => o.id === optionId)
  if (!option) return { ok: false, error: 'Вариант не найден' }
  if (p.lead.status === 'booked' || p.lead.status === 'done') return { ok: false, error: 'Бронь уже оформлена' }

  await prisma.proposal.update({ where: { id: p.id }, data: { chosenOptionId: option.id, acceptedAt: new Date() } })
  await prisma.leadEvent.create({ data: { leadId: p.leadId, type: 'proposal_accepted', text: `Гость выбрал вариант «${option.title}» — ${option.price} BYN` } })
  await notifyTelegram(
    p.lead.property.telegramChatId,
    `<b>${escapeHtml(p.lead.name)} выбрал(а) «${escapeHtml(option.title)}»</b>\n${option.price} BYN\n${appUrl(`/admin/leads/${p.leadId}`)}`,
  )
  revalidatePath(`/o/${token}`)
  revalidatePath('/admin', 'layout')
  return { ok: true }
}

const pledgeSchema = z.object({
  name: z.string().trim().min(2, 'Как вас зовут?').max(60),
  amount: z.number().int().min(1, 'Укажите сумму').max(100_000),
})

export async function pledge(token: string, input: { name: string; amount: number }): Promise<Result> {
  const parsed = pledgeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Проверьте данные' }
  const p = await load(token)
  if (!p || !p.splitEnabled) return { ok: false, error: 'Сбор недоступен' }
  if ((await prisma.contribution.count({ where: { proposalId: p.id } })) >= 40) return { ok: false, error: 'Слишком много участников' }

  const c = await prisma.contribution.create({ data: { proposalId: p.id, name: parsed.data.name, amount: parsed.data.amount } })
  await prisma.leadEvent.create({ data: { leadId: p.leadId, type: 'contribution', text: `${c.name} присоединился(ась) к сбору: ${c.amount} BYN` } })
  revalidatePath(`/o/${token}`)
  revalidatePath('/admin', 'layout')
  return { ok: true, id: c.id }
}

export async function markPaid(token: string, contributionId: string): Promise<Result> {
  const p = await load(token)
  if (!p) return { ok: false, error: 'Предложение не найдено' }
  const c = await prisma.contribution.findFirst({ where: { id: contributionId, proposalId: p.id, status: 'pledged' } })
  if (!c) return { ok: false, error: 'Уже отмечено' }
  await prisma.contribution.update({ where: { id: c.id }, data: { status: 'marked_paid' } })
  await prisma.leadEvent.create({ data: { leadId: p.leadId, type: 'contribution', text: `${c.name} отметил(а) перевод ${c.amount} BYN — проверьте поступление` } })
  await notifyTelegram(
    p.lead.property.telegramChatId,
    `💸 ${escapeHtml(c.name)} перевёл(а) ${c.amount} BYN по брони ${escapeHtml(p.lead.name)} — проверьте и подтвердите\n${appUrl(`/admin/leads/${p.leadId}`)}`,
  )
  revalidatePath(`/o/${token}`)
  revalidatePath('/admin', 'layout')
  return { ok: true }
}
