import type { FC } from 'react'
import Link from 'next/link'
import s from './Footer.module.css'

const Footer: FC = () => {
  const year = new Date().getFullYear()

  return (
    <footer className={s.footer}>
      <div className={`container ${s.inner}`}>
        <div className={s.col}>
          <div className={s.brand}>Timber&Grain</div>
          <div className="muted">© {year} Timber&Grain</div>
        </div>

        <div className={s.col}>
          <div className={s.title}>Контакты</div>
          <div className="muted">+375 (29) 180-95-30</div>
          <div className="muted">timberandgrain@gmail.com</div>
        </div>

        <div className={s.col}>
          <div className={s.title}>Навигация</div>
          <nav className={s.links}>
            <Link href="/products">Каталог</Link>
            <Link href="/login">Войти</Link>
            <Link href="/contacts">О нас</Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}

export default Footer
