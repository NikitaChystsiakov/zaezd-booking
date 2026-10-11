// Даты заезда и выезда храним без времени: 'YYYY-MM-DD'.
// Внутри работаем в UTC, чтобы часовой пояс сервера не сдвигал день.

export type ISODate = string

export function toDate(iso: ISODate): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

export function toISO(d: Date): ISODate {
  return d.toISOString().slice(0, 10)
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = toDate(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return toISO(d)
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000)
}

/** Все даты из полуинтервала [from, to) */
export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = []
  for (let d = from; d < to; d = addDays(d, 1)) out.push(d)
  return out
}

export function weekday(iso: ISODate): number {
  return toDate(iso).getUTCDay()
}

export function overlaps(aFrom: ISODate, aTo: ISODate, bFrom: ISODate, bTo: ISODate): boolean {
  return aFrom < bTo && bFrom < aTo
}

export function todayISO(timeZone = 'Europe/Minsk'): ISODate {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date())
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const WEEKDAYS_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

export function formatDay(iso: ISODate): string {
  const d = toDate(iso)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

export function formatRange(from: ISODate, to: ISODate): string {
  const a = toDate(from)
  const b = toDate(to)
  if (a.getUTCMonth() === b.getUTCMonth()) return `${a.getUTCDate()}–${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`
  return `${formatDay(from)} – ${formatDay(to)}`
}

export function weekdayShort(iso: ISODate): string {
  return WEEKDAYS_SHORT[weekday(iso)]
}

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}
