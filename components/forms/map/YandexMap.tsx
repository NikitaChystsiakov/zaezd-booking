// app/(public)/contacts/page.tsx
'use client'

import { useState, useEffect } from 'react'
import s from './YandexMap.module.css'
import { MapPin, Phone, Mail, Clock, Store } from 'lucide-react'

const HOURS = 'Ежедневно: 10:00–20:00'
const EMAIL = 'info@timbergrain.by'
const PHONE = '+375 (29) 180-95-30'

interface Shop {
  id: number
  city: string
  street: string
}

export default function ContactsPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v1/shops')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ошибка: ${res.status}`)
        return res.json()
      })
      .then(data => setShops(data))
      .catch(error => console.error('Ошибка загрузки:', error))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className={s.wrapper}>
      <div className={s.leftColumn}>
        <div className={s.card}>
          <h1 className={s.title}>Timber&Grain</h1>
          <p className={s.subtitle}>
            Собственное производство мягкой мебели и сеть магазинов
          </p>
          
          <div className={s.contactGrid}>
            <div className={s.contactItem}>
              <Phone className={s.contactIcon} />
              <div>
                <div className={s.contactLabel}>Телефон</div>
                <a href={`tel:${PHONE.replace(/\D/g, '')}`} className={s.contactValue}>
                  {PHONE}
                </a>
              </div>
            </div>
            
            <div className={s.contactItem}>
              <Mail className={s.contactIcon} />
              <div>
                <div className={s.contactLabel}>E-mail</div>
                <a href={`mailto:${EMAIL}`} className={s.contactValue}>
                  {EMAIL}
                </a>
              </div>
            </div>
            
            <div className={s.contactItem}>
              <Clock className={s.contactIcon} />
              <div>
                <div className={s.contactLabel}>График</div>
                <div className={s.contactValue}>{HOURS}</div>
              </div>
            </div>
          </div>
        </div>
        <div className={s.shopsCard}>
          <div className={s.shopsHeader}>
            <Store className={s.shopsIcon} />
            <h2 className={s.shopsTitle}>Магазины</h2>
            <span className={s.shopsCount}>{shops.length}</span>
          </div>
          
          {loading ? (
            <div className={s.loading}>
              <div className={s.loadingSpinner}></div>
            </div>
          ) : shops.length > 0 ? (
            <div className={s.shopsList}>
              {shops.map((shop, index) => (
                <div key={shop.id} className={s.shopCard}>
                  <div className={s.shopNumber}>{index + 1}</div>
                  <div className={s.shopInfo}>
                    <h3 className={s.shopCity}>{shop.city}</h3>
                    <p className={s.shopAddress}>
                      <MapPin size={12} className={s.addressIcon} />
                      {shop.street}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={s.emptyState}>
              <Store size={32} className={s.emptyIcon} />
              <p>Нет активных магазинов</p>
            </div>
          )}
        </div>
      </div>

      {/* Правая часть - Карта (50%) */}
      <div className={s.rightColumn}>
        <div className={s.mapCard}>
          <div className={s.mapHeader}>
            <h2 className={s.mapTitle}>
              <MapPin className={s.mapIcon} />
              Мы на карте
            </h2>
          </div>
          
          <div className={s.mapContainer}>
            <iframe
              className={s.mapIframe}
              src="https://yandex.ru/map-widget/v1/?um=constructor%3AВАШ_ID&source=constructor"
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              title="Карта магазинов Timber&Grain"
            />
          </div>
        </div>
      </div>
    </div>
  )
}