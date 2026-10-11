'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { demoLogin, login } from './actions'
import { Logo } from '@/components/Logo'

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null)

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 inline-flex">
          <Logo />
        </Link>
        <div className="card p-6">
          <h1 className="text-xl font-semibold">Вход для администратора</h1>
          <form action={action} className="mt-5 space-y-3">
            <div>
              <label className="label" htmlFor="email">Почта</label>
              <input id="email" name="email" type="email" className="field" autoComplete="username" required />
            </div>
            <div>
              <label className="label" htmlFor="password">Пароль</label>
              <input id="password" name="password" type="password" className="field" autoComplete="current-password" required />
            </div>
            {error && <p className="text-sm text-accent" role="alert">{error}</p>}
            <button className="btn-ink w-full" disabled={pending}>
              {pending ? 'Входим…' : 'Войти'}
            </button>
          </form>
          <div className="my-5 flex items-center gap-3 text-xs text-ink-3">
            <div className="h-px flex-1 bg-line" /> или <div className="h-px flex-1 bg-line" />
          </div>
          <form action={demoLogin}>
            <button className="btn-primary w-full">Посмотреть демо-усадьбу</button>
          </form>
        </div>
      </div>
    </main>
  )
}
