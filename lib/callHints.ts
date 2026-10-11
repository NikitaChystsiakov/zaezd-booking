// «О чём спросить при звонке» — простые правила по данным заявки.
// Это место, куда позже встанет ИИ: та же карточка, только подсказки умнее.

import type { Conflict } from './availability'

type HintLead = {
  unitId: string | null
  guests: number
  occasion: string | null
  comment: string | null
  extraIds: string[]
  checkIn: Date
}

export function callHints(lead: HintLead, ctx: { baseGuests?: number; conflicts: Conflict[]; hasProposal: boolean }): string[] {
  const hints: string[] = []
  const text = `${lead.occasion ?? ''} ${lead.comment ?? ''}`.toLowerCase()

  if (ctx.conflicts.some((c) => c.kind !== 'request')) hints.push('Даты заняты — предложите соседние даты или другой дом')
  else if (ctx.conflicts.some((c) => c.kind === 'request')) hints.push('На эти даты есть другая заявка в работе — не затягивайте с предоплатой')
  if (!lead.unitId) hints.push(`Подберите объект: компания ${lead.guests} чел.`)
  if (ctx.baseGuests && lead.guests > ctx.baseGuests) hints.push(`Гостей больше базовых ${ctx.baseGuests} — назовите доплату за каждого`)
  if (/корпоратив|ооо|компан|безнал|договор/.test(text)) hints.push('Юрлицо: уточните реквизиты для договора и счёта')
  if (/собак|кошк|живот|питом/.test(text)) hints.push('Животные: расскажите правила и залог')
  if (/музык|шум|ночь|до час/.test(text)) hints.push('Музыка: напомните про тишину после 23:00 и колонки на улице')
  if (/свадьб|юбилей|банкет/.test(text)) hints.push('Банкет: кухня своя или кейтеринг, кто накрывает, нужен ли шатёр')
  if (lead.extraIds.length === 0) hints.push('Предложите баню или чан — их часто добавляют после звонка')
  const daysToArrival = Math.round((lead.checkIn.getTime() - Date.now()) / 86_400_000)
  if (daysToArrival <= 7) hints.push(`Заезд через ${Math.max(daysToArrival, 0)} дн. — договоритесь о предоплате сегодня`)
  if (!ctx.hasProposal) hints.push('После звонка отправьте КП — гость сможет собрать предоплату с компании')
  return hints
}
