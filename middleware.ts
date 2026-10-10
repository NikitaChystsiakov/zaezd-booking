import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { getCookieName } from '@/lib/jwt'

type Role = 'customer' | 'manager' | 'driver' | 'factory_worker' | 'admin'

type JwtPayload = {
  sub: string
  role: Role
  email?: string
  phone?: string | null
}

const RULES: Array<{ prefix: string; allow: Role[] }> = [
  { prefix: '/admin', allow: ['admin'] },
  { prefix: '/manager', allow: ['manager', 'admin'] },
  { prefix: '/driver', allow: ['driver', 'admin'] },
  { prefix: '/factory', allow: ['factory_worker', 'admin'] },

  { prefix: '/account', allow: ['customer', 'manager', 'driver', 'factory_worker', 'admin'] },

  // защита админских API
  { prefix: '/api/v1/admin', allow: ['admin'] },
  { prefix: '/api/v1/manager', allow: ['manager', 'admin'] },
  { prefix: '/api/v1/driver', allow: ['driver', 'admin'] },
  { prefix: '/api/v1/factory', allow: ['factory_worker', 'admin'] },
]

async function verifyToken(token: string): Promise<JwtPayload | null> {
  const secret = process.env.JWT_SECRET
  if (!secret) return null

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret)
    )
    return payload as unknown as JwtPayload
  } catch {
    return null
  }
}

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search)
  return NextResponse.redirect(url)
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  const rule = RULES.find(r => pathname === r.prefix || pathname.startsWith(r.prefix + '/'))
  if (!rule) return NextResponse.next()

  const isAccountRoute = pathname === '/account' || pathname.startsWith('/account/')

  const cookieName = getCookieName()
  const token = req.cookies.get(cookieName)?.value
  if (!token) {
    if (isAccountRoute) {
      return redirectToLogin(req)
    }

    const url = req.nextUrl.clone()
    url.pathname = '/403'
    return NextResponse.redirect(url)
  }

  const payload = await verifyToken(token)
  if (!payload?.role) {
    const url = req.nextUrl.clone()
    url.pathname = isAccountRoute ? '/login' : '/403'

    const res = NextResponse.redirect(url)
    res.cookies.delete(cookieName)
    return res
  }

  if (!rule.allow.includes(payload.role)) {
    const url = req.nextUrl.clone()
    url.pathname = '/403'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/manager/:path*',
    '/driver/:path*',
    '/factory/:path*',
    '/account/:path*',
    '/api/v1/admin/:path*',
    '/api/v1/manager/:path*',
    '/api/v1/driver/:path*',
    '/api/v1/factory/:path*',
  ],
}
