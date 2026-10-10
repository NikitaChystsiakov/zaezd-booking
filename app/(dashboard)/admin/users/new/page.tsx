'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/useToast'
import s from './AdminUserCreatePage.module.css'
import type { UserInfoForAdmin } from '@/types/user'

type Role = UserInfoForAdmin['role']

type FormState = {
  email: string
  phone: string
  first_name: string
  second_name: string
  last_name: string
  role: Role
  active: boolean
  password: string
}

const initial: FormState = {
  email: '',
  phone: '',
  first_name: '',
  second_name: '',
  last_name: '',
  role: 'customer',
  active: true,
  password: '',
}

export default function AdminUserCreatePage() {
  const [form, setForm] = useState<FormState>(initial)
  const [saving, setSaving] = useState(false)
  const { show } = useToast()
  const router = useRouter()

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      setSaving(true)

      const payload = {
        email: form.email.trim(),
        phone: form.phone.trim() ? form.phone.trim() : null,
        first_name: form.first_name.trim() ? form.first_name.trim() : null,
        second_name: form.second_name.trim() ? form.second_name.trim() : null,
        last_name: form.last_name.trim() ? form.last_name.trim() : null,
        role: form.role,
        active: form.active,
        password: form.password.trim(), 
      }

      const res = await fetch('/api/v1/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || 'Не удалось создать пользователя')

      show({ title: 'Готово', description: 'Пользователь создан', duration: 3000 })
      router.push('/admin/users')
      router.refresh()
    } catch (e: any) {
      console.error(e)
      show({
        title: 'Ошибка',
        description: e?.message ?? 'Ошибка создания пользователя',
        duration: 6000,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={s.wrapper}>
      <div className={s.card}>
        <div className={s.headerRow}>
          <div>
            <h2 className={s.title}>Создать пользователя</h2>
          </div>

          <Link className={s.secondaryBtn} href="/admin">
            ← Назад
          </Link>
        </div>

        <form className={s.form} onSubmit={onSubmit}>
          <div className={s.grid}>
            <div className={s.field}>
              <label>Email *</label>
              <input
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="email@example.com"
                required
              />
            </div>

            <div className={s.field}>
              <label>Телефон</label>
              <input
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="+375..."
              />
            </div>

            <div className={s.field}>
              <label>Имя</label>
              <input
                value={form.first_name}
                onChange={(e) => set('first_name', e.target.value)}
                placeholder="Имя"
              />
            </div>

            <div className={s.field}>
              <label>Отчество</label>
              <input
                value={form.second_name}
                onChange={(e) => set('second_name', e.target.value)}
                placeholder="Отчество"
              />
            </div>

            <div className={s.field}>
              <label>Фамилия</label>
              <input
                value={form.last_name}
                onChange={(e) => set('last_name', e.target.value)}
                placeholder="Фамилия"
              />
            </div>

            <div className={s.field}>
              <label>Роль *</label>
              <select value={form.role} onChange={(e) => set('role', e.target.value as Role)}>
                <option value="customer">customer</option>
                <option value="manager">manager</option>
                <option value="driver">driver</option>
                <option value="factory_worker">factory_worker</option>
                <option value="admin">admin</option>
              </select>
            </div>

            <div className={s.field} style={{ gridColumn: '1 / -1' }}>
              <label>Пароль *</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder="Задай пароль пользователю"
                required
              />
            </div>

            <div className={s.fieldInline} style={{ gridColumn: '1 / -1' }}>
            <label className={s.checkbox}>
              <input
                id="active"
                type="checkbox"
                checked={form.active}
                onChange={(e) => set('active', e.target.checked)}
              />
              </label>
              <label className={s.label} htmlFor="active">Активен</label>
            </div>
          </div>

          <div className={s.actions}>
            <button className={s.secondaryBtn} type="button" onClick={() => setForm(initial)} disabled={saving}>
              Сбросить
            </button>

            <button className={s.primaryBtn} type="submit" disabled={saving}>
              {saving ? 'Создаю…' : 'Создать пользователя'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
