'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import s from './SuccessPage.module.css'

export default function SuccessPage() {
  const params = useSearchParams()
  const sessionId = params.get('session_id')

  return (
    <section className={s.wrapper}>
      <div className={s.card} role="status" aria-live="polite">
        <h2 className={s.title}>Оплата успешно завершена</h2>
        <p className={s.subtitle}>
          Ваш заказ принят и оплачен. Мы уже начали обработку - статус можно будет
          увидеть в кабинете.
        </p>

        <div className={s.actions}>
          {sessionId ? (
            <a
              className={s.primaryBtn}
              href={`/api/v1/stripe/invoice/${sessionId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Скачать чек (PDF)
            </a>
          ) : null}

          <Link className={s.secondaryBtn} href="/">
            ← На главную
          </Link>
        </div>
      </div>
    </section>
  )
}
