export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { signJwt, getCookieName } from '@/lib/jwt';
import { toPlainUser } from '@/lib/bigint';
import { loginUser } from '@/server/services/auth.service';
import type { users } from '@prisma/client';

interface LoginBody {
  email: string;
  password: string;
  phone?: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, phone }: LoginBody = await req.json();

    if (!email || !password) {
      return NextResponse.json({ message: 'email и password обязательны' }, { status: 400 });
    }

    const user: users = await loginUser({
      email: String(email).trim().toLowerCase(),
      password,
      phone: String(phone).trim().toLowerCase(),
    });

    const payload = {
      sub: user.id.toString(),
      role: user.role,
      email: user.email,
      phone: user.phone,
    };

    const token = await signJwt(payload);

    const res = NextResponse.json(
      { user: toPlainUser(user), token, redirect: '/account' },
      { status: 200 },
    );

    res.cookies.set(getCookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 дней
    });

    return res;
  } catch (e: any) {
    if (e.code === 'BAD_CREDENTIALS' || e.code === 'BAD_PASSWORD') {
      return NextResponse.json({ message: e.message }, { status: 401 });
    }
    console.error('login error', e);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
