'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useToast } from '@/hooks/useToast'
import s from './AdminUsersPage.module.css'
import type { UserInfoForAdmin } from '@/types/user'

type EditDraft = {
  first_name: string
  second_name: string
  last_name: string
  phone: string
  email: string
  role: UserInfoForAdmin['role']
  active: boolean
  password: string 
}

// Функция для перевода ролей на русский
const translateRole = (role: string): string => {
  const translations: Record<string, string> = {
    'customer': 'Покупатель',
    'manager': 'Менеджер',
    'driver': 'Водитель',
    'factory_worker': 'Рабочий',
    'admin': 'Администратор'
  }
  return translations[role] || role
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserInfoForAdmin[]>([])
  const [loading, setLoading] = useState(true)

  const [editing, setEditing] = useState<UserInfoForAdmin | null>(null)
  const [draft, setDraft] = useState<EditDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [mounted, setMounted] = useState(false)

  const { show } = useToast()

  const roleOptions = useMemo(
    () => [
      { value: 'customer', label: 'Пользователь' },
      { value: 'manager', label: 'Менеджер' },
      { value: 'driver', label: 'Водитель' },
      { value: 'factory_worker', label: 'Рабочий' },
      { value: 'admin', label: 'Администратор' }
    ] as const,
    []
  )

  async function loadUsers(signal?: AbortSignal) {
    try {
      const res = await fetch('/api/v1/admin/users', { signal })
      if (!res.ok) throw new Error('Ошибка при загрузке пользователей')
      const data = (await res.json()) as UserInfoForAdmin[]
      setUsers(Array.isArray(data) ? data : [])
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      console.error(err)
      show({
        title: 'Ошибка',
        description: 'Не удалось загрузить список пользователей',
        duration: 6000,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
    const ac = new AbortController()
    loadUsers(ac.signal)
    return () => ac.abort()
  }, [])

  function openEdit(u: UserInfoForAdmin) {
    setEditing(u)
    setDraft({
      first_name: u.first_name ?? '',
      second_name: u.second_name ?? '',
      last_name: u.last_name ?? '',
      phone: u.phone ?? '',
      email: u.email ?? '',
      role: u.role,
      active: !!u.active,
      password: '',
    })
  }

  function closeEdit() {
    if (saving) return
    setEditing(null)
    setDraft(null)
  }

  // Esc закрывает модалку
  useEffect(() => {
    if (!editing) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeEdit()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editing, saving])

  async function saveEdit() {
    if (!editing || !draft) return

    try {
      setSaving(true)

      const payload = {
        first_name: draft.first_name.trim() ? draft.first_name.trim() : null,
        second_name: draft.second_name.trim() ? draft.second_name.trim() : null,
        last_name: draft.last_name.trim() ? draft.last_name.trim() : null,
        phone: draft.phone.trim() ? draft.phone.trim() : null,
        email: draft.email.trim(),
        role: draft.role,
        active: draft.active,
        ...(draft.password.trim() ? { password: draft.password.trim() } : {}),
      }

      const res = await fetch(`/api/v1/admin/users/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || 'Не удалось обновить пользователя')

      const updated: UserInfoForAdmin = data.user ?? data
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))

      show({ title: 'Готово', description: 'Пользователь обновлён', duration: 3000 })
      closeEdit()
    } catch (e: any) {
      console.error(e)
      show({
        title: 'Ошибка',
        description: e?.message ?? 'Ошибка обновления пользователя',
        duration: 6000,
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className={s.muted}>Загрузка...</p>

  const modal =
    editing && draft ? (
      <div className={s.modalOverlay} onMouseDown={closeEdit}>
        <div className={s.modalCard} onMouseDown={(e) => e.stopPropagation()}>
          <div className={s.modalHeader}>
            <div>
              <div className={s.modalTitle}>Редактирование пользователя</div>
              <div className={s.modalSubtitle}>ID: {editing.id}</div>
            </div>
            <button className={s.iconBtn} onClick={closeEdit} aria-label="Close">
              ✕
            </button>
          </div>

          <div className={s.formGrid}>
            <div className={s.field}>
              <label>Имя</label>
              <input
                value={draft.first_name}
                onChange={(e) => setDraft({ ...draft, first_name: e.target.value })}
                placeholder="Имя"
              />
            </div>

            <div className={s.field}>
              <label>Отчество</label>
              <input
                value={draft.second_name}
                onChange={(e) => setDraft({ ...draft, second_name: e.target.value })}
                placeholder="Отчество"
              />
            </div>

            <div className={s.field}>
              <label>Фамилия</label>
              <input
                value={draft.last_name}
                onChange={(e) => setDraft({ ...draft, last_name: e.target.value })}
                placeholder="Фамилия"
              />
            </div>

            <div className={s.field}>
              <label>Email</label>
              <input
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                placeholder="Email"
              />
            </div>

            <div className={s.field}>
              <label>Телефон</label>
              <input
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                placeholder="Телефон"
              />
            </div>

            <div className={s.field}>
              <label>Роль</label>
              <select
                value={draft.role}
                onChange={(e) =>
                  setDraft({ ...draft, role: e.target.value as EditDraft['role'] })
                }
              >
                {roleOptions.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={s.fieldInline}>
              <label className={s.checkbox}>
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                id="u_active"
              />
              </label>
              <label htmlFor="u_active">Активен</label>
            </div>

            <div className={s.field} style={{ gridColumn: '1 / -1' }}>
              <label>Сброс пароля (опционально)</label>
              <input
                type="password"
                value={draft.password}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                placeholder="Новый пароль (если нужно)"
              />
            </div>
          </div>

          <div className={s.modalActions}>
            <button className={s.secondaryBtn} disabled={saving} onClick={closeEdit}>
              Отмена
            </button>
            <button className={s.primaryBtn} disabled={saving} onClick={saveEdit}>
              {saving ? 'Сохраняю…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    ) : null

  return (
    <div className={s.wrapper}>
      <div className={s.card}>
        <div className={s.headerRow}>
          <h2 className={s.title}>Все пользователи</h2>
          <Link className={s.secondaryBtn} href="/admin">
            ← Назад
          </Link>
        </div>

        {users.length === 0 ? (
          <div className={s.placeholder}>
            <p>Пользователей пока нет</p>
          </div>
        ) : (
          <>
            {/* Десктопная таблица */}
            <div className={s.tableWrapper}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Имя</th>
                    <th>Email</th>
                    <th>Телефон</th>
                    <th>Роль</th>
                    <th>Статус</th>
                    <th>Создан</th>
                    <th>Действие</th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td className={s.nameCell}>
                        <div className={s.nameMain}>
                          {u.first_name || u.last_name
                            ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()
                            : '—'}
                        </div>
                        
                      </td>
                      <td>{u.email}</td>
                      <td>{u.phone ?? '—'}</td>
                      <td>
                        <span className={s.roleBadge} data-role={u.role}>
                          {translateRole(u.role)}
                        </span>
                      </td>
                      <td>
                        <span className={u.active ? s.badgeActive : s.badgeInactive}>
                          {u.active ? 'Активен' : 'Выключен'}
                        </span>
                      </td>
                      <td>
                        {new Date(u.created_at).toLocaleDateString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </td>
                      <td className={s.actionsCell}>
                        <button className={s.editBtn} onClick={() => openEdit(u)}>
                          Редактировать
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Мобильные карточки */}
            <div className={s.mobileList}>
              {users.map((u) => (
                <div key={u.id} className={s.userCard}>
                  <div className={s.userHeader}>
                    <div>
                      <div className={s.userName}>
                        {u.first_name || u.last_name
                          ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()
                          : 'Без имени'}
                      </div>
                      <div className={s.userId}>ID: {u.id}</div>
                    </div>
                    <div className={s.userStatus}>
                      <span className={u.active ? s.badgeActive : s.badgeInactive}>
                        {u.active ? 'Активен' : 'Выключен'}
                      </span>
                    </div>
                  </div>
                  
                  <div className={s.userDetails}>
                    <div className={s.detailRow}>
                      <span className={s.detailLabel}>Email:</span>
                      <span className={s.detailValue}>{u.email}</span>
                    </div>
                    <div className={s.detailRow}>
                      <span className={s.detailLabel}>Телефон:</span>
                      <span className={s.detailValue}>{u.phone || '—'}</span>
                    </div>
                    <div className={s.detailRow}>
                      <span className={s.detailLabel}>Роль:</span>
                      <span className={`${s.detailValue} ${s.roleBadge}`} data-role={u.role}>
                        {translateRole(u.role)}
                      </span>
                    </div>
                
                    <div className={s.detailRow}>
                      <span className={s.detailLabel}>Создан:</span>
                      <span className={s.detailValue}>
                        {new Date(u.created_at).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  </div>
                  
                  <div className={s.userActions}>
                    <button className={s.editBtn} onClick={() => openEdit(u)}>
                      Редактировать
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {mounted && modal ? createPortal(modal, document.body) : null}
    </div>
  )
}