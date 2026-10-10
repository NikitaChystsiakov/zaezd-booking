'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/useToast';
import { loginSchema } from '@/server/validations/auth';
import s from './LoginPage.module.css';

const LoginForm = () => {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { show } = useToast();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const fd = new FormData(e.currentTarget);
    const payload = {
      email: fd.get('email')?.toString() ?? '',
      password: fd.get('password')?.toString() ?? '',
      phone: fd.get('phone')?.toString() || undefined,
    };

    const parsed = loginSchema.safeParse(payload);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Ошибка ввода данных';
      show({
        title: 'Ошибка входа',
        description: msg,
        duration: 6000,
      });
      return;
    }

    setLoading(true);
    try {
      const r = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      const data = await r.json();
      if (!r.ok) throw new Error(data?.message || 'Ошибка входа');

      show({
        title: 'Успешно',
        description: 'Вы вошли в систему',
        duration: 5000,
      });

      router.push(data.redirect ?? '/account');
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
        <h1 className={s.title}>Вход</h1>

        <form className={s.form} id="logForm" onSubmit={onSubmit}>
          <label className={s.field}>
            <span className={s.label}>E-mail</span>
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
          form="logForm"
          type="submit"
          disabled={loading}
        >
          {loading ? 'Входим…' : 'Войти'}
        </button>

        <a className="btn btn-ghost" href="/register">
          Создать аккаунт
        </a>
      </div>
    </section>
  );
};

export default LoginForm;
