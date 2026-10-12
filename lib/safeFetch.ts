import 'server-only'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

// Загрузка чужой ссылки (iCal-лента) так, чтобы через неё нельзя было достучаться до внутренней сети сервера (SSRF).
// Проверяем не текст адреса, а настоящие IP: имя может указывать на 127.0.0.1, а редирект — уводить внутрь.
// Остаточный риск: между проверкой имени и самим запросом DNS может ответить иначе (DNS rebinding).
// Полностью закрывается запросом по проверенному IP через собственный dispatcher или отдельным исходящим прокси.

const MAX_REDIRECTS = 3
const MAX_BYTES = 2 * 1024 * 1024

/** Адрес не из публичного интернета: loopback, частные сети, link-local (облачные метаданные), CGNAT, мультикаст */
export function isPrivateIp(ip: string): boolean {
  const mapped = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateIp(mapped[1])

  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    )
  }
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase()
    return v === '::' || v === '::1' || /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith('ff')
  }
  return true
}

async function assertPublic(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('нужна ссылка http(s)')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address)
  if (!addresses.length || addresses.some(isPrivateIp)) throw new Error('внутренние адреса запрещены')
}

/** Текст по ссылке: с проверкой каждого шага редиректа, таймаутом и ограничением размера */
export async function fetchPublicText(rawUrl: string, init: { accept?: string; timeoutMs?: number } = {}): Promise<string> {
  let url = new URL(rawUrl)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(url)
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(init.timeoutMs ?? 8000),
      headers: init.accept ? { accept: init.accept } : undefined,
    })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location')!, url)
      continue
    }
    if (!res.ok) throw new Error(`сервер ответил ${res.status}`)
    return readLimited(res)
  }
  throw new Error('слишком много перенаправлений')
}

async function readLimited(res: Response): Promise<string> {
  if (!res.body) return ''
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BYTES) {
      await reader.cancel()
      throw new Error('файл слишком большой')
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString('utf8')
}
