'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { useEffect, useState, type FC } from 'react';
import s from './Header.module.css'; 

interface HeaderClientProps {
  session?: {
    id: number | bigint;
    role: string;
    first_name?: string | null;
  } | null;
}

const CartIcon: FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10
         0c-1.1 0-1.99.9-1.99 2S15.9 22 17 22s2-.9 2-2-.9-2-2-2zM7.16 14h9.45c.75 0
         1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 21.99 5H6.21l-.94-2H2a1 1 0 1 0 0 2h1.61l3.44
         7.59-1.28 2.34A2 2 0 0 0 7.16 18H20a1 1 0 1 0 0-2H7.16l1-2z"
      fill="currentColor"
    />
  </svg>
);

const HeaderClient: FC<HeaderClientProps> = ({ session }) => {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function logout() {
    await fetch('/api/v1/auth/logout', { method: 'POST' });
    router.replace('/');
    router.refresh();
  }

  const isAuthed = !!session;
  const role = session?.role;

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  return (
    <header className={s.header}>
      <div className={`container ${s.inner}`}>
        <Link href="/" className={s.brand} onClick={() => setMenuOpen(false)}>
          Timber&Grain
        </Link>

        <button
          className={s.burger}
          aria-label="Открыть меню"
          aria-expanded={menuOpen}
          aria-controls="primary-nav"
          onClick={() => setMenuOpen(v => !v)}
        >
          {menuOpen ? '✕' : '☰'}
        </button>

        <nav id="primary-nav" className={`${s.nav} ${menuOpen ? s.open : ''}`}>
          <Link href="/products" onClick={() => setMenuOpen(false)}>Каталог</Link>
          <Link href="/about" onClick={() => setMenuOpen(false)}>О нас</Link>

          {isAuthed && <Link href="/account" onClick={() => setMenuOpen(false)}>Кабинет</Link>}
          {isAuthed && role === 'admin'   && <Link href="/admin"   onClick={() => setMenuOpen(false)}>Панель администратора</Link>}
          {isAuthed && role === 'manager' && <Link href="/manager" onClick={() => setMenuOpen(false)}>Панель менеджера</Link>}
          {isAuthed && role === 'driver'  && <Link href="/driver"  onClick={() => setMenuOpen(false)}>Панель водителя</Link>}
          {isAuthed && role === 'factory_worker' && <Link href="/factory" onClick={() => setMenuOpen(false)}>Панель производства</Link>
}

        </nav>

        <div className={s.actions}>
          <Link href="/cart" className={s.iconBtn} aria-label="Корзина" onClick={() => setMenuOpen(false)}>
            <CartIcon />
          </Link>

          {isAuthed ? (
            <button className="btn btn-outline" onClick={() => { setMenuOpen(false); logout(); }}>
              Выйти
            </button>
          ) : (
            <Link href="/login" className="btn btn-outline" onClick={() => setMenuOpen(false)}>
              Войти
            </Link>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};

export default HeaderClient;
