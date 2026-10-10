'use client'

import Link from 'next/link'
import type { FC } from 'react'

import s from './ErrorPages.module.css'

type Props = {
  error: Error & { digest?: string }
  reset: () => void
}

const GlobalErrorBoundary: FC<Props> = ({ reset }) => {
  return (
    <div className={s.wrapper}>
      <section className={s.card}>
        <div className={s.badge}>
          <span className={s.dot} />
          Ошибка на стороне сервера
        </div>

        <div>
          <div className={s.code}>500</div>
          <h1 className={s.title}>Что-то пошло не так</h1>
          <p className={s.description}>
            Мы уже знаем о проблеме и постараемся исправить её в ближайшее время. Попробуйте
            обновить страницу или вернитесь чуть позже.
          </p>
        </div>

        <div>
          <div className={s.actions}>
            <button type="button" onClick={reset} className={s.primaryButton}>
              Попробовать ещё раз
            </button>
            <Link href="/" className={s.secondaryButton}>
              На главную
            </Link>
          </div>
          <p className={s.helper}>
            Если ошибка повторяется, напишите нам - это поможет быстрее её устранить.
          </p>
        </div>
      </section>
    </div>
  )
}

export default GlobalErrorBoundary

