'use client'

import { useActionState } from 'react'
import { demoLogin, login } from './actions'

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null)

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-side lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/p/butsevichi/country-sunset.jpg" alt="" className="photo-grade absolute inset-0 size-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-side via-side/30 to-transparent" />
        <div className="absolute inset-x-12 bottom-12 text-side-ink">
          <div className="display text-[56px] leading-[1.05]">Брони усадьбы — в одном месте</div>
          <p className="mt-4 max-w-md text-side-ink-2">Заявки с сайта, календарь домов, цены и синхронизация с Куфаром, Реалтом и Google Календарём.</p>
        </div>
      </div>

      <div className="grid place-items-center px-4 py-12">
        <div className="w-full max-w-sm">
          <h1 className="display text-[44px]">Вход</h1>
          <p className="mt-1 text-ink-2">Панель управления бронированием</p>
          <form action={action} className="mt-8 space-y-4">
            <div>
              <label className="label" htmlFor="email">Почта</label>
              <input id="email" name="email" type="email" className="field" autoComplete="username" required />
            </div>
            <div>
              <label className="label" htmlFor="password">Пароль</label>
              <input id="password" name="password" type="password" className="field" autoComplete="current-password" required />
            </div>
            {error && <p className="text-sm text-alert" role="alert">{error}</p>}
            <button className="btn-primary h-12 w-full" disabled={pending}>
              {pending ? 'Входим…' : 'Войти'}
            </button>
          </form>
          <div className="my-6 flex items-center gap-3 text-xs text-ink-3">
            <div className="h-px flex-1 bg-line" /> или <div className="h-px flex-1 bg-line" />
          </div>
          <form action={demoLogin}>
            <button className="btn-ghost h-12 w-full">Открыть демо — усадьба «Буцевичи»</button>
          </form>
        </div>
      </div>
    </main>
  )
}
