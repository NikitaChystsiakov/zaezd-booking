import Link from 'next/link'
import type { FC } from 'react'

import s from '../ErrorPages.module.css'

const ForbiddenPage: FC = () => {
  return (
    <div className={s.wrapper}>
      <section className={s.card}>
        <div className={s.badge}>
          <span className={s.dot} />
          Доступ запрещён
        </div>

        <div>
          <div className={s.code}>403</div>
          <h1 className={s.title}>У вас нет прав для просмотра</h1>
          <p className={s.description}>
            Эта страница доступна только авторизованным пользователям или пользователям с
            особыми правами. Если вы считаете, что это ошибка — обратитесь к администратору.
          </p>
        </div>

        <div>
          <div className={s.actions}>
            <Link href="/login" className={s.primaryButton}>
              Войти в аккаунт
            </Link>
            <Link href="/" className={s.secondaryButton}>
              На главную
            </Link>
          </div>
          <p className={s.helper}>
            После авторизации попробуйте ещё раз. Если доступа всё равно нет — свяжитесь с нами.
          </p>
        </div>
      </section>
    </div>
  )
}

export default ForbiddenPage

