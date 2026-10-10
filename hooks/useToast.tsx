'use client'

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  type PropsWithChildren,
} from 'react'
import s from './Toast.module.css' 

export interface ToastData {
  id?: string
  title?: string
  description?: string
  duration?: number 
}

export interface ToastAPI {
  show: (toast: ToastData) => string
  dismiss: (id: string) => void
}

const ToastCtx = createContext<ToastAPI | null>(null)

export const ToastProvider = ({ children }: PropsWithChildren) => {
  const [toasts, setToasts] = useState<Required<ToastData>[]>([])

  const show = useCallback((toast: ToastData): string => {
    const id = toast.id ?? Math.random().toString(36).slice(2)
    const t: Required<ToastData> = {
      id,
      title: toast.title ?? '',
      description: toast.description ?? '',
      duration: toast.duration ?? 4000,
    }
    setToasts(list => [...list, t])

    if (t.duration) {
      setTimeout(() => {
        setToasts(list => list.filter(x => x.id !== id))
      }, t.duration)
    }

    return id
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(list => list.filter(x => x.id !== id))
  }, [])

  const api = useMemo<ToastAPI>(() => ({ show, dismiss }), [show, dismiss])

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className={s.viewport}>
        {toasts.map(t => (
          <div key={t.id} className={s.toast}>
            <div className={s.head}>
              {t.title && <div className={s.title}>{t.title}</div>}
              <button
                className={s.close}
                onClick={() => dismiss(t.id)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            {t.description && <div className={s.desc}>{t.description}</div>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast(): ToastAPI {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}
