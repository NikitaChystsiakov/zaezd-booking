import Link from 'next/link'
import type { FC } from 'react'

import s from './ErrorPages.module.css'

const NotFoundPage: FC = () => {
  return (
    <div className={s.wrapper}>
      <section className={s.card}>
        <div className={s.badge}>
          <span className={s.dot} />
          Страница не найдена
        </div>

        <div>
          <div className={s.code}>404</div>
          <h1 className={s.title}>Такой страницы у нас нет</h1>
          <p className={s.description}>
            Возможно, вы опечатались в адресе или страница была перенесена. Попробуйте начать
            с главной или откройте каталог мебели.
          </p>
        </div>

        <div>
          <div className={s.actions}>
            <Link href="/" className={s.primaryButton}>
              На главную
            </Link>
            <Link href="/products" className={s.secondaryButton}>
              В каталог
            </Link>
          </div>
          <p className={s.helper}>Если ошибка повторяется — напишите нам, мы разберёмся.</p>
        </div>
      </section>
    </div>
  )
}

export default NotFoundPage

