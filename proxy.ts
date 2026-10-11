import { NextRequest, NextResponse } from 'next/server'
import { verifyJwt, getCookieName } from '@/lib/jwt'

// Быстрая проверка на входе в админку. Права на конкретные данные
// всё равно проверяются в каждом server action по propertyId из сессии.
export async function proxy(req: NextRequest) {
  const token = req.cookies.get(getCookieName())?.value
  if (token) {
    try {
      await verifyJwt(token)
      return NextResponse.next()
    } catch {}
  }
  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.search = ''
  return NextResponse.redirect(url)
}

export const config = { matcher: ['/admin/:path*'] }
