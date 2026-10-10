// app/api/v1/auth/check/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyJwt } from '@/lib/jwt'
import type { AppJwtPayload } from '@/lib/jwt'

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('auth_token')?.value
    
    if (!token) {
      return NextResponse.json(
        { 
          authenticated: false,
          message: 'No authentication token found'
        },
        { status: 200 }
      )
    }

    // Проверяем токен
    const payload = await verifyJwt<AppJwtPayload>(token)
    
    return NextResponse.json({
      authenticated: true,
      user: {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        phone: payload.phone
      }
    })
    
  } catch (error) {
    console.error('Auth check error:', error)
    return NextResponse.json(
      { 
        authenticated: false,
        message: 'Invalid or expired token'
      },
      { status: 200 }
    )
  }
}

// Для HEAD запросов (быстрая проверка без тела ответа)
export async function HEAD(req: NextRequest) {
  const token = req.cookies.get('auth_token')?.value
  const isAuthenticated = !!token
  
  return new NextResponse(null, {
    status: isAuthenticated ? 200 : 401,
    headers: {
      'X-Authenticated': isAuthenticated.toString()
    }
  })
}