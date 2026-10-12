import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { isPrivateIp, fetchPublicText } = await import('./safeFetch')

describe('isPrivateIp', () => {
  it.each(['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1'])(
    '%s — внутренний',
    (ip) => expect(isPrivateIp(ip)).toBe(true),
  )

  it.each(['93.184.216.34', '8.8.8.8', '172.15.0.1', '172.32.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8'])('%s — публичный', (ip) => expect(isPrivateIp(ip)).toBe(false))
})

describe('fetchPublicText', () => {
  it.each(['http://localhost/', 'http://127.0.0.1:5432/', 'http://[::1]/', 'http://169.254.169.254/latest/meta-data/', 'http://0.0.0.0/', 'file:///etc/passwd'])('%s не запрашивается', async (url) => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchPublicText(url)).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('редирект на внутренний адрес останавливается', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'http://127.0.0.1:8080/admin' } }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchPublicText('http://93.184.216.34/cal.ics')).rejects.toThrow(/внутренние/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('публичный адрес с редиректом на публичный читается', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: '/real.ics' } }))
      .mockResolvedValueOnce(new Response('BEGIN:VCALENDAR'))
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchPublicText('http://93.184.216.34/cal.ics')).resolves.toBe('BEGIN:VCALENDAR')
  })

  it('слишком большой файл обрывается', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('x'.repeat(3 * 1024 * 1024))))
    await expect(fetchPublicText('http://93.184.216.34/big.ics')).rejects.toThrow(/слишком большой/)
  })
})
