'use client'

import s from './Header.module.css'

type Theme = 'light' | 'dark'

function getCookieTheme(): Theme | null {
  const m = document.cookie.match(/(?:^|;\s*)theme=(light|dark)/)
  return (m?.[1] as Theme) || null
}

function setCookieTheme(theme: Theme) {
  document.cookie = `theme=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`
}

function applyTheme(next: Theme) {
  document.documentElement.dataset.theme = next
  document.documentElement.style.colorScheme = next
  try { localStorage.setItem('theme', next) } catch {}
  try { setCookieTheme(next) } catch {}
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 18a6 6 0 1 1 0-12 6 6 0 0 1 0 12Zm0-16a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1Zm0 18a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1Zm10-8a1 1 0 0 1-1 1h-1a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1ZM4 12a1 1 0 0 1-1 1H2a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1Zm15.07-7.07a1 1 0 0 1 0 1.41l-.7.7a1 1 0 1 1-1.42-1.4l.7-.71a1 1 0 0 1 1.42 0ZM7.05 17.95a1 1 0 0 1 0 1.41l-.7.7a1 1 0 1 1-1.42-1.4l.71-.71a1 1 0 0 1 1.41 0Zm11.32 1.41a1 1 0 0 1-1.41 0l-.71-.7a1 1 0 1 1 1.4-1.42l.72.71a1 1 0 0 1 0 1.41ZM6.34 8.05a1 1 0 0 1-1.41 0l-.7-.71a1 1 0 0 1 1.4-1.42l.71.72a1 1 0 0 1 0 1.41Z"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21 15.5A8.5 8.5 0 0 1 8.5 3a.9.9 0 0 0-1.07 1.09A7 7 0 1 0 19.91 16.57.9.9 0 0 0 21 15.5Z"
      />
    </svg>
  )
}

export default function ThemeToggle() {
  const toggle = () => {
    const cur =
      (document.documentElement.dataset.theme as Theme) ||
      getCookieTheme() ||
      'light'

    applyTheme(cur === 'dark' ? 'light' : 'dark')
  }

  return (
    <button
      type="button"
      className={s.iconBtn}
      onClick={toggle}
      aria-label="Переключить тему"
      title="Переключить тему"
      suppressHydrationWarning
    >
      <span className={s.iconSun} aria-hidden="true"><SunIcon /></span>
      <span className={s.iconMoon} aria-hidden="true"><MoonIcon /></span>
    </button>
  )
}
