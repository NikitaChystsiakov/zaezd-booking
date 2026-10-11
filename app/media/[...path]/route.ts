import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { UPLOAD_DIR } from '@/lib/uploads'

const TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }

export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path
  const file = path.resolve(/* turbopackIgnore: true */ UPLOAD_DIR, ...parts)
  // Не выпускаем за пределы папки загрузок
  if (!file.startsWith(UPLOAD_DIR + path.sep)) return new Response('Not found', { status: 404 })
  const type = TYPES[path.extname(file).toLowerCase()]
  if (!type) return new Response('Not found', { status: 404 })
  try {
    const body = await readFile(file)
    return new Response(body, { headers: { 'content-type': type, 'cache-control': 'public, max-age=31536000, immutable' } })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
