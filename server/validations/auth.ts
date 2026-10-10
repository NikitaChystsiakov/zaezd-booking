import { z } from 'zod';

const phoneSchema = z.preprocess(
  v => (typeof v == 'string' ? v.replace(/[\s()-]/g, '') : v),
  z.string().regex(/^\+?\d{7,15}$/, 'Введите корректный телефон'),
);

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Введите корректный e-mail'),
  password: z.string().min(6, 'Пароль должен быть не короче 6 символов').max(16, 'Пароль слишком длинный'),
  first_name: z.string().trim().min(3, 'Имя обязательно'),
  last_name: z.string().trim().min(4, 'Фамилия обязательна'),
  second_name: z.string().trim().min(4, 'Отчество обязательно'),
  phone: phoneSchema,
});


export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Введите корректный e-mail'),
  password: z.string().min(6, 'Введите пароль'),
  phone: phoneSchema,
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
