'use client'

import { useEffect, useMemo, useState } from 'react'
import s from './AdminShopsPage.module.css'
import Link from 'next/link';

type Shop = { id: number; city: string; street: string; active: boolean }

export default function AdminShopsPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [city, setCity] = useState('')
  const [street, setStreet] = useState('')
  const [active, setActive] = useState(true)
  const canCreate = city.trim().length > 0 && street.trim().length > 0 && !saving

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch('/api/v1/admin/shops', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || 'Не удалось загрузить магазины')
      setShops(Array.isArray(data) ? data : [])
    } catch (e: any) {
      setErr(e?.message ?? 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const sorted = useMemo(() => {
    return [...shops].sort((a, b) => {
      const ac = a.city.localeCompare(b.city, 'ru')
      if (ac !== 0) return ac
      return a.street.localeCompare(b.street, 'ru')
    })
  }, [shops])

  async function createShop() {
    try {
      setSaving(true)
      setErr(null)

      const res = await fetch('/api/v1/admin/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, street, active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || 'Не удалось создать магазин')

      const created = data.shop as Shop
      setShops(prev => [created, ...prev])
      setCity('')
      setStreet('')
      setActive(true)
    } catch (e: any) {
      setErr(e?.message ?? 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(shop: Shop) {
    const next = !shop.active
    
    setShops(prev => prev.map(x => (x.id === shop.id ? { ...x, active: next } : x)))

    try {
      const res = await fetch(`/api/v1/admin/shops/${shop.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || 'Не удалось обновить магазин')
    } catch (e) {
      // откат
      setShops(prev => prev.map(x => (x.id === shop.id ? { ...x, active: shop.active } : x)))
    }
  }

  return (
    <section className={s.wrapper}>
      <div className={s.head}>
        <h1 className={s.title}>Магазины</h1>
        <Link className={s.secondary} href="/admin">
            ← Назад
          </Link>
        <button className={s.secondary} onClick={load} disabled={loading || saving}>
          Обновить
        </button>
      </div>

      <div className={s.card}>
        <div className={s.cardTitle}>Добавить магазин</div>

        <div className={s.formRow}>
          <input
            className={s.input}
            placeholder="Город"
            value={city}
            onChange={e => setCity(e.target.value)}
          />
          <input
            className={s.input}
            placeholder="Адрес (улица, дом)"
            value={street}
            onChange={e => setStreet(e.target.value)}
          />
          <label className={s.checkbox}>
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
            <span>Активен</span>
          </label>

          <button className={s.primary} onClick={createShop} disabled={!canCreate}>
            {saving ? 'Сохраняем…' : 'Добавить'}
          </button>
        </div>

        {err && <div className={s.error}>{err}</div>}
      </div>

      <div className={s.card}>
        <div className={s.cardTitle}>Список</div>

        {loading ? (
          <div className={s.muted}>Загрузка…</div>
        ) : sorted.length === 0 ? (
          <div className={s.muted}>Пока нет магазинов</div>
        ) : (
          <div className={s.table}>
            <div className={s.tHead}>
              <div>ID</div>
              <div>Город</div>
              <div>Адрес</div>
              <div>Статус</div>
            </div>

            {sorted.map(shop => (
              <div key={shop.id} className={s.tRow}>
                <div className={s.idCell}>{shop.id}</div>
                <div>{shop.city}</div>
                <div>{shop.street}</div>

                <button
                  className={`${s.pill} ${shop.active ? s.pillOn : s.pillOff}`}
                  onClick={() => toggleActive(shop)}
                  type="button"
                >
                  {shop.active ? 'Активен' : 'Выключен'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
