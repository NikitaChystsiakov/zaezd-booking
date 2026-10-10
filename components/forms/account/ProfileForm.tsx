'use client';

import { useState, FormEvent } from 'react';
import { useToast } from '@/hooks/useToast';
import { updateProfileSchema, type UpdateProfileDto } from '@/server/validations/profile';
import s from './ProfileForm.module.css'
import type { UserInfo } from '@/types/user';

export default function ProfileForm({ user }: UserInfo) {
  const [form, setForm] = useState({
    first_name: user.first_name ?? '',
    last_name: user.last_name ?? '',
    second_name: user.second_name ?? '',
    phone: user.phone ?? '', 
  });
  const [loading, setLoading] = useState(false);
  const { show } = useToast();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    
    const parsed = updateProfileSchema.safeParse(form);
    if (!parsed.success) {
      show({
        title: 'Ошибка',
        description: parsed.error.issues[0]?.message ?? 'Неверно заполнены поля',
        duration: 6000,
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data as UpdateProfileDto),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Не удалось обновить профиль');

      show({ title: 'Успешно', description: 'Изменения сохранены', duration: 5000 });
    } catch (err) {
      show({
        title: 'Ошибка',
        description: err instanceof Error ? err.message : 'Сбой при сохранении',
        duration: 6000,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={s.wrapper}>
    <div className={s.card}>
    <h1 className= {s.title}>Личная информация</h1>

    <form className={s.account_form} onSubmit={handleSubmit}>      
        <label className={s.field}>
          <span className={s.label}>Имя</span>
        <input 
          className={s.input}
          value={form.first_name}
          onChange={e => setForm({ ...form, first_name: e.target.value })}
        />
        </label>

        <label className={s.field}>
          <span className={s.label}>Фамилия</span>
        <input
          className={s.input}
          value={form.last_name}
          onChange={e => setForm({ ...form, last_name: e.target.value })}
        />
        </label>

      
        <label className={s.field}>
          <span className={s.label}>Отчество</span>
        <input
          className={s.input}
          value={form.second_name}
          onChange={e => setForm({ ...form, second_name: e.target.value })}
        />
      </label>

      <label className={s.field}>
        <span className={s.label}>Email</span>
        <input className={s.input} value={user.email} disabled />
        </label>

      <label className={s.field}>
        <span className={s.label}>Телефон</span>
        <input
          className={s.input}
          value={form.phone}
          onChange={e => setForm({ ...form, phone: e.target.value })}
          required 
        />
      </label>

      <button type="submit" className="btn btn-primary" style={{marginTop: 8}} disabled={loading}>
        {loading ? 'Сохраняем...' : 'Сохранить изменения'}
      </button>
    </form>
    </div>
    </section>
  );
}
