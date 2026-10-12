import 'server-only'
import { headers } from 'next/headers'

// Ограничение частоты в памяти процесса: окно скользит, старые попытки забываются.
// Защищает от подбора пароля и от потока заявок. Для нескольких серверов счётчики нужно вынести
// в общее хранилище (Redis, Upstash) — интерфейс при этом не меняется.

const hits = new Map<string, number[]>()

/** Пропускает не больше `limit` обращений за `windowMs`. Возвращает false, когда лимит исчерпан. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= limit) {
    hits.set(key, recent)
    return false
  }
  recent.push(now)
  hits.set(key, recent)
  // Не даём карте расти бесконечно
  if (hits.size > 10_000) for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k)
  return true
}

export function resetRateLimit(key?: string) {
  if (key) hits.delete(key)
  else hits.clear()
}

/** Адрес клиента. За прокси (Vercel, nginx) он приходит в x-forwarded-for первым в списке. */
export async function clientIp(): Promise<string> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
}
