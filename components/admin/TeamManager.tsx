'use client'

import { useState, useTransition } from 'react'
import { KeyRound, Trash2, UserPlus } from 'lucide-react'
import type { Role } from '@prisma/client'
import { changeRole, inviteUser, removeUser, resetPassword } from '@/app/admin/team/actions'
import { ROLE_HINT, ROLE_LABEL, ROLES } from '@/lib/permissions'
import { Section } from './ui'

type Member = { id: string; name: string; email: string; role: Role }

export function TeamManager({ users, currentUserId }: { users: Member[]; currentUserId: string }) {
  const [pending, run] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [secret, setSecret] = useState<{ who: string; password: string } | null>(null)
  const [form, setForm] = useState({ name: '', email: '', role: 'staff' as Role })

  const act = (fn: () => Promise<{ ok: boolean; error?: string; password?: string }>, who?: string) =>
    run(async () => {
      setError(null)
      const res = await fn()
      if (!res.ok) setError(res.error ?? 'Не получилось')
      else if (res.password && who) setSecret({ who, password: res.password })
    })

  return (
    <div className="space-y-6">
      {secret && (
        <div role="status" className="rounded-2xl border border-line bg-surface p-5">
          <div className="font-semibold">Временный пароль для {secret.who}</div>
          <code className="mt-2 inline-block rounded-xl bg-surface-2 px-3 py-2 text-base tracking-wide">{secret.password}</code>
          <p className="mt-2 text-sm text-ink-3">Покажется только сейчас — передайте его сотруднику. После закрытия страницы увидеть его снова нельзя.</p>
          <button className="btn-quiet btn-sm mt-3" onClick={() => setSecret(null)}>Готово</button>
        </div>
      )}
      {error && <p className="text-sm text-alert" role="alert">{error}</p>}

      <Section title="Сотрудники" sub="В усадьбе всегда остаётся хотя бы один владелец.">
        <ul className="divide-y divide-line">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">
                  {u.name} {u.id === currentUserId && <span className="chip ml-1 bg-muted-soft text-ink-2">это вы</span>}
                </div>
                <div className="truncate text-sm text-ink-3">{u.email}</div>
              </div>
              <select
                className="field h-10 w-48"
                aria-label={`Роль: ${u.name}`}
                value={u.role}
                disabled={pending}
                onChange={(e) => act(() => changeRole(u.id, e.target.value as Role))}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
              <button
                className="grid size-9 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink"
                aria-label={`Выдать новый пароль: ${u.name}`}
                title="Выдать новый пароль"
                disabled={pending}
                onClick={() => confirm(`Выдать ${u.name} новый пароль? Старый перестанет работать.`) && act(() => resetPassword(u.id), u.name)}
              >
                <KeyRound size={15} />
              </button>
              {u.id !== currentUserId && (
                <button
                  className="grid size-9 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-alert"
                  aria-label={`Удалить: ${u.name}`}
                  title="Удалить"
                  disabled={pending}
                  onClick={() => confirm(`Удалить ${u.name}? Вход будет закрыт сразу.`) && act(() => removeUser(u.id))}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Добавить сотрудника">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            act(async () => {
              const res = await inviteUser(form)
              if (res.ok) setForm({ name: '', email: '', role: 'staff' })
              return res
            }, form.name)
          }}
        >
          <div>
            <label className="label" htmlFor="team-name">Имя</label>
            <input id="team-name" className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label" htmlFor="team-email">Почта (для входа)</label>
            <input id="team-email" type="email" className="field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="team-role">Роль</label>
            <select id="team-role" className="field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]} — {ROLE_HINT[r]}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <button className="btn-primary" disabled={pending}>
              <UserPlus size={16} /> {pending ? 'Добавляем…' : 'Добавить'}
            </button>
          </div>
        </form>
      </Section>
    </div>
  )
}
