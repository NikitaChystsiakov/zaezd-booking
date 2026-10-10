import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { updateProfileSchema } from '@/server/validations/profile';

export async function POST(req: NextRequest) {
    try {
        const cookieToken = (await cookies()).get('auth_token')?.value;

        const auth = req.headers.get("authorization") || "";
        const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : null;

        const token = bearer || cookieToken;
        if (!token) return NextResponse.json({ message: 'Нет доступа' }, { status: 401 });

        const payload = await verifyJwt(token);
        const json = await req.json();
        const data = updateProfileSchema.parse(json);

        const userId = BigInt(payload.sub);

        // Проверка номера телефона
        if (data.phone && data.phone.trim() !== '') {
            const phone = data.phone.trim();
            
            // Проверка что номер начинается с +375
            if (!phone.startsWith('+375')) {
                return NextResponse.json(
                    { message: 'Номер телефона должен начинаться с +375' },
                    { status: 400 }
                );
            }
            
            // Проверка общей длины (13 символов: +375 + 9 цифр)
            if (phone.length !== 13) {
                return NextResponse.json(
                    { message: 'Номер телефона должен содержать ровно 13 символов (+375XXXXXXXXX)' },
                    { status: 400 }
                );
            }
            
            // Проверка что после +375 только цифры
            const digitsOnly = phone.substring(4);
            if (!/^\d{9}$/.test(digitsOnly)) {
                return NextResponse.json(
                    { message: 'После +375 должны быть только цифры' },
                    { status: 400 }
                );
            }
            
            // Проверка кода оператора (первые 2 цифры после +375)
            const operatorCode = phone.substring(4, 6);
            const validOperators = ['29', '33', '44', '25', '17', '16', '21', '22', '23', '24', '15', '99'];
            if (!validOperators.includes(operatorCode)) {
                return NextResponse.json(
                    { message: 'Неверный код оператора. Допустимые: ' + validOperators.join(', ') },
                    { status: 400 }
                );
            }

            // Проверка на уникальность телефона (исключая текущего пользователя)
            const existingUserWithPhone = await prisma.users.findFirst({
                where: {
                    phone: phone,
                    id: {
                        not: userId // исключаем текущего пользователя
                    }
                }
            });

            if (existingUserWithPhone) {
                return NextResponse.json(
                    { message: 'Этот номер телефона уже занят другим пользователем' },
                    { status: 409 }
                );
            }
        }

        await prisma.users.update({
            where: { id: userId },
            data,
        });

        return NextResponse.json({ message: 'ОК' }, { status: 200 });
    } catch (e: any) {
        if (e.issues?.length) {
            return NextResponse.json(
                { message: e.issues[0]?.message ?? 'Неверные данные' },
                { status: 400 }
            );
        }
        if (e?.code === 'P2002' && Array.isArray(e?.meta?.target) && e.meta.target.includes('phone')) {
            return NextResponse.json({ message: 'Телефон уже занят' }, { status: 409 });
        }

        console.error('update user error:', e);
        return NextResponse.json({ message: 'Ошибка обновления' }, { status: 500 });
    }
}