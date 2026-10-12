import { afterEach, describe, expect, it, vi } from 'vitest'

// jwt.ts читает секрет при первом обращении, поэтому каждый тест берёт свежую копию модуля
async function freshJwt() {
  vi.resetModules()
  return import('./jwt')
}

const payload = { sub: 'u1', propertyId: 'p1', role: 'owner' as const }

afterEach(() => vi.unstubAllEnvs())

describe('секрет сессий', () => {
  it('в продакшене без JWT_SECRET токен не подписывается — запасного секрета нет', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('JWT_SECRET', '')
    const { signJwt, verifyJwt } = await freshJwt()
    await expect(signJwt(payload)).rejects.toThrow(/JWT_SECRET/)
    await expect(verifyJwt('a.b.c')).rejects.toThrow(/JWT_SECRET/)
  })

  it.each(['короткий', 'change-me-to-a-long-random-string'])('в продакшене секрет «%s» не принимается', async (secret) => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('JWT_SECRET', secret)
    const { signJwt } = await freshJwt()
    await expect(signJwt(payload)).rejects.toThrow(/JWT_SECRET/)
  })

  it('с настоящим секретом токен подписывается и проверяется; чужой секрет его не принимает', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('JWT_SECRET', 'a'.repeat(40))
    const mine = await freshJwt()
    const token = await mine.signJwt(payload)
    expect(await mine.verifyJwt(token)).toMatchObject(payload)

    vi.stubEnv('JWT_SECRET', 'b'.repeat(40))
    const other = await freshJwt()
    await expect(other.verifyJwt(token)).rejects.toThrow()
  })

  it('в разработке запасной секрет остаётся — локальный запуск работает без настройки', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('JWT_SECRET', '')
    const { signJwt, verifyJwt } = await freshJwt()
    expect(await verifyJwt(await signJwt(payload))).toMatchObject(payload)
  })
})
