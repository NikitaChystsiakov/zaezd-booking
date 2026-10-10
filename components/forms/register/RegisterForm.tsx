'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { registerSchema } from '@/server/validations/auth';
import { useToast } from '@/hooks/useToast';
import s from './RegisterForm.module.css';

export default function RegisterForm() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { show } = useToast();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
   
    const fd = new FormData(e.currentTarget);
    const payload = {
      first_name: fd.get('first_name')?.toString() ?? '',
      last_name: fd.get('last_name')?.toString() ?? '',
      second_name: fd.get('second_name')?.toString() ?? '',
      email: fd.get('email')?.toString() ?? '',
      phone: fd.get('phone')?.toString() ?? '',
      password: fd.get('password')?.toString() ?? '',
    };

    const result = registerSchema.safeParse(payload);
    if (!result.success) {
      const firstError = result.error.issues[0]?.message ?? 'Ошибка ввода данных';
      show({
        title: 'Ошибка ввода',
        description: firstError,
        duration: 6000,
      });
      return;
    }

    setLoading(true);
    try {
      const r = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.data),
      });

      const data = await r.json();
      if (!r.ok) throw new Error(data?.message || 'Ошибка регистрации');

      show({
        title: 'Успешно!',
        description: 'Аккаунт создан',
        duration: 6000,
      });
      

      router.push('/account');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
      show({
        title: 'Ошибка',
        description: message,
        duration: 6000,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={s.wrapper}>
      <div className={s.card}>
        <h1 className={s.title}>Регистрация</h1>

        <form className={s.form} id="regForm" onSubmit={onSubmit}>
          <label className={s.field}>
            <span className={s.label}>Имя</span>
            <input
              className={s.input}
              name="first_name"
              type="text"
              required
              placeholder="Иван"
            />
          </label>

          <label className={s.field}>
            <span className={s.label}>Фамилия</span>
            <input
              className={s.input}
              name="last_name"
              type="text"
              required
              placeholder="Иванов"
            />
          </label>

          <label className={s.field}>
            <span className={s.label}>Отчество</span>
            <input
              className={s.input}
              name="second_name"
              type="text"
              placeholder="Иванович"
            />
          </label>

          <label className={s.field}>
            <span className={s.label}>Email</span>
            <input
              className={s.input}
              name="email"
              type="email"
              required
              placeholder="you@example.com"
            />
          </label>

          <label className={s.field}>
            <span className={s.label}>Телефон</span>
            <input
              className={s.input}
              name="phone"
              type="tel"
              placeholder="+375…"
            />
          </label>

          <label className={s.field}>
            <span className={s.label}>Пароль</span>
            <input
              className={s.input}
              name="password"
              type="password"
              required
              placeholder="••••••••"
            />
          </label>
        </form>
      </div>

      <div className={s.actions}>
        <button
          className="btn btn-primary"
          disabled={loading}
          form="regForm"
          type="submit"
        >
          {loading ? 'Регистрируем…' : 'Зарегистрироваться'}
        </button>

        <a className="btn btn-ghost" href="/login">
          У меня уже есть аккаунт
        </a>
      </div>
    </section>
  );
}
