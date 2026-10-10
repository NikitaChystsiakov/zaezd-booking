export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { registerUser } from '@/server/services/auth.service';
import { signJwt, getCookieName } from '@/lib/jwt';
import { toPlainUser } from '@/lib/bigint';
import { registerSchema } from '@/server/validations/auth';


export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const data = registerSchema.parse(json);
    const user = await registerUser(data);
    const payload = { sub: user.id.toString(), role: user.role, email: user.email };
    const token = await signJwt(payload);

    const res = NextResponse.json({ user: toPlainUser(user), token }, { status: 201 });
    res.cookies.set(getCookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (e: any) {
    if (e instanceof Error && 'issues' in e) {
      
      return NextResponse.json({ message: (e as any).issues[0]?.message ?? 'Неверные данные' }, { status: 400 });
    }
    if (e.code === 'EMAIL_TAKEN') {
      return NextResponse.json({ message: e.message }, { status: 409 });
    }
    if (e.code === 'PHONE_TAKEN') {
      return NextResponse.json({ message: e.message }, { status: 409 });
    }    
    console.error('register error', e);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
