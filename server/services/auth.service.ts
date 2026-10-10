import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import type { users, Role } from '@prisma/client';
import { registerSchema, loginSchema, type RegisterDto, type LoginDto } from '@/server/validations/auth';


export async function registerUser(data: RegisterDto): Promise<users> {
  const normalizedEmail = data.email.trim().toLowerCase();

  
  const exists = await prisma.users.findUnique({
    where: { email: normalizedEmail },
  });
  if (exists) {
    const err = new Error('Пользователь с таким email уже существует');
    (err as any).code = 'EMAIL_TAKEN';
    throw err;
  }
  
  if (data.phone) {
    const existsPhone = await prisma.users.findFirst({
      where: { phone: data.phone },
    });
    if (existsPhone) {
      const err = new Error('Пользователь с таким телефоном уже существует');
      (err as any).code = 'PHONE_TAKEN';
      throw err;
    }
  }

  const password_hash = await bcrypt.hash(data.password, 10);

  const user = await prisma.users.create({
    data: {
      email: normalizedEmail,
      password_hash,
      role: 'customer' as Role,
      first_name: data.first_name ?? null,
      last_name: data.last_name ?? null,
      second_name: data.second_name ?? null,
      phone: data.phone,
      created_at: new Date(),
      active: true,
    },
  });

  return user;
}

export async function registerUserSafe(input: unknown): Promise<users> {
  const data = registerSchema.parse(input);
  return registerUser(data);
}

export async function loginUser(data: LoginDto): Promise<users> {
  const normalizedEmail = data.email.trim().toLowerCase();

  const user = await prisma.users.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user || !user.password_hash) {
    const err = new Error('Неверный e-mail или пароль');
    (err as any).code = 'BAD_CREDENTIALS';
    throw err;
  }

  if (data.phone && user.phone && user.phone !== data.phone) {
    const err = new Error('Неверные данные');
    (err as any).code = 'BAD_CREDENTIALS';
    throw err;
  }

  const ok = await bcrypt.compare(data.password, user.password_hash);
  if (!ok) {
    const err = new Error('Неверный пароль');
    (err as any).code = 'BAD_PASSWORD';
    throw err;
  }

  return user;
}

export async function loginUserSafe(input: unknown): Promise<users> {
  const data = loginSchema.parse(input);
  return loginUser(data);
}