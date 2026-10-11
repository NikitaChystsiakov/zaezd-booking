import { NextResponse, type NextRequest } from 'next/server'
import { getCookieName } from '@/lib/jwt'

// Сброс входа. Куку можно удалить только в обработчике запроса, не при отрисовке страницы,
// поэтому requireSession при устаревшей сессии отправляет сюда.
export function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/login', req.url))
  res.cookies.delete(getCookieName())
  return res
}
