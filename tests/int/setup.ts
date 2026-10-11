// Подмены для того, что в Next работает только внутри запроса: cookies, redirect, revalidatePath.
// Сам код server actions, Prisma и база — настоящие.

import { vi } from 'vitest'

export const cookieJar = new Map<string, string>()

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => void cookieJar.set(name, value),
    delete: (name: string) => void cookieJar.delete(name),
  }),
}))

// redirect в Next прерывает выполнение исключением — повторяем это, чтобы тест видел, куда отправили
export class RedirectError extends Error {
  constructor(public url: string) {
    super(`NEXT_REDIRECT ${url}`)
  }
}
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new RedirectError(url)
  },
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

// cache() из React кэширует только внутри серверного рендера; в тестах — без кэша
vi.mock('react', async (orig) => ({ ...(await orig<typeof import('react')>()), cache: <T,>(fn: T) => fn }))
