'use client'

import { useEffect, useState } from 'react'
import { useCart } from '@/components/cart/CartProvider'
import { useToast } from '@/hooks/useToast'
import { useAuthCheck } from '@/hooks/useAuthCheck'
import Link from 'next/link'
import s from './CartPage.module.css'

type Shop = {
  id: number
  city: string
  street: string
}

type DeliveryType = 'pickup' | 'home_delivery'

type CheckoutFormState = {
  name: string
  second_name: string
  last_name: string
  phone: string
  email: string
  deliveryType: DeliveryType
  shopId: string 
  city: string
  street: string
  house: string
  apartment: string
  entrance: string
  floor: string
  note: string
}

const initialForm: CheckoutFormState = {
  name: '',
  second_name: '',
  last_name: '',
  phone: '',
  email: '',
  deliveryType: 'pickup',
  shopId: '',
  city: '',
  street: '',
  house: '',
  apartment: '',
  entrance: '',
  floor: '',
  note: '',
}

export default function CartPage() {
  const { items, totalPrice, setQuantity, removeItem, clear } = useCart()
  const toast = useToast()
  const { isAuthenticated } = useAuthCheck()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [shops, setShops] = useState<Shop[]>([])
  const [form, setForm] = useState<CheckoutFormState>(initialForm)

  useEffect(() => {
    async function loadShops() {
      try {
        const res = await fetch('/api/v1/shops')
        if (!res.ok) return
        const data = (await res.json()) as Shop[]
        setShops(Array.isArray(data) ? data : [])
      } catch (e) {
        console.warn('shops load error', e)
      }
    }
    loadShops()
  }, [])

  const showClearCartNotification = () => {
    toast.show({
      title: 'Корзина очищена',
      description: 'Все товары удалены из корзины',
      duration: 3000,
    })
  }

  const showRemoveItemNotification = (itemName: string) => {
    toast.show({
      title: 'Товар удален',
      description: `${itemName} удален из корзины`,
      duration: 3000,
    })
  }

  const handleClearCart = () => {
    clear()
    showClearCartNotification()
  }

  const handleRemoveItem = (sku: string, itemName: string) => {
    removeItem(sku)
    showRemoveItemNotification(itemName)
  }

  // Обработка клика на "Оформить заказ"
  const handleCheckoutClick = () => {
    if (!isAuthenticated) {
      toast.show({
        title: 'Требуется авторизация',
        description: 'Войдите в систему, чтобы оформить заказ',
        duration: 3000,
      })
      return
    }
    setIsFormOpen(prev => !prev)
  }

  // если корзина пустая
  if (items.length === 0) {
    return (
      <section className={s.wrapper}>
        <h2 className={s.title}>Корзина</h2>
        <p className={s.muted}>Корзина пуста</p>
      </section>
    )
  }

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmitOrder(e: React.FormEvent) {
    e.preventDefault()
    
    if (!isAuthenticated) {
      toast.show({
        title: 'Требуется авторизация',
        description: 'Войдите в систему для оформления заказа',
        duration: 4000,
      })
      return
    }

    if (items.length === 0) {
      toast.show({
        title: 'Корзина пуста',
        description: 'Добавьте товары в корзину перед оформлением заказа',
        duration: 4000,
      })
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Валидация формы
      if (form.deliveryType === 'pickup' && !form.shopId) {
        toast.show({
          title: 'Выберите магазин',
          description: 'Пожалуйста, выберите магазин для самовывоза',
          duration: 4000,
        })
        setLoading(false)
        return
      }

      const res = await fetch('/api/v1/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            name: form.name,
            second_name: form.second_name,
            last_name: form.last_name,
            phone: form.phone,
            email: form.email,
          },
          delivery: {
            type: form.deliveryType,
            shopId:
              form.deliveryType === 'pickup' && form.shopId
                ? Number(form.shopId)
                : null,
            address:
              form.deliveryType === 'home_delivery'
                ? {
                  city: form.city,
                  street: form.street,
                  house: form.house,
                  apartment: form.apartment || null,
                  entrance: form.entrance || null,
                  floor: form.floor || null,
                }
                : null,
          },
          note: form.note || null,
          items, 
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        // Обработка ошибок с бекенда
        let errorMessage = data?.message || 'Не удалось создать заказ'
        
        // Если есть issues от zod валидации
        if (data?.issues && Array.isArray(data.issues)) {
          const firstIssue = data.issues[0]
          errorMessage = `Не верно заполнены поля: ${firstIssue.path?.join('.') || ''} ${firstIssue.message || ''}`
        }
        
        if (data?.details) {
          errorMessage = `${errorMessage}: ${data.details}`
        }
        
        toast.show({
          title: 'Ошибка оформления заказа',
          description: errorMessage,
          duration: 5000,
        })
        
        throw new Error(errorMessage)
      }

      if (!data.url) {
        toast.show({
          title: 'Ошибка платежной системы',
          description: 'Не удалось создать платежную сессию',
          duration: 5000,
        })
        throw new Error('Не удалось создать платеж')
      }

      toast.show({
        title: 'Оформление заказа!',
        description: 'Переходим к оплате...',
        duration: 3000,
      })

      // Небольшая задержка перед редиректом, чтобы пользователь увидел уведомление
      setTimeout(() => {
        window.location.href = data.url
      }, 1000)

    } catch (e: any) {
      console.error(e)
      setError(e?.message ?? 'Ошибка оформления заказа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className={s.wrapper}>
      <h2 className={s.title}>Корзина</h2>

      {/* Список товаров */}
      <div className={s.list}>
        {items.map(item => (
          <div key={item.sku} className={s.row}>
            {item.image_path && (
              <div className={s.thumb}>
                <img src={item.image_path} alt={item.name} />
              </div>
            )}

            <div className={s.info}>
              <div className={s.name}>{item.name}</div>
              <div className={s.material}>{item.materialName}</div>
            </div>

            <div className={s.qtyCell}>
              <input
                type="number"
                min={1}
                value={item.quantity}
                onChange={e =>
                  setQuantity(item.sku, Number(e.target.value) || 1)
                }
                className={s.qtyInput}
              />
            </div>

            <div className={s.rightSection}>
              <div className={s.totalCell}>
                {(item.price * item.quantity).toLocaleString('ru-RU')} BYN
              </div>

              <button
                className={s.removeBtn}
                onClick={() => handleRemoveItem(item.sku, item.name)}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Итог по корзине */}
      <div className={s.summary}>
        <span>Итого:</span>
        <span>{totalPrice.toLocaleString('ru-RU')} BYN</span>
      </div>

      {/* Кнопки под корзиной */}
      <div className={s.actions}>
        <button className={s.secondary} onClick={handleClearCart}>
          Очистить корзину
        </button>

        {isAuthenticated ? (
          <button
            className={s.primary}
            onClick={handleCheckoutClick}
          >
            {isFormOpen ? 'Скрыть форму' : 'Оформить заказ'}
          </button>
        ) : (
          <div className={s.authPrompt}>
            <div className={s.authButtons}>
              <Link href="/login" className={s.firstly}>
                Войти
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Форма оформления заказа — показываем только авторизованным */}
      {isAuthenticated && isFormOpen && (
        <form className={s.checkoutForm} onSubmit={handleSubmitOrder}>
          <h3 className={s.subtitle}>Контактные данные</h3>

          <div className={s.formRow}>
            <input
              name="name"
              placeholder="Имя"
              value={form.name}
              onChange={handleChange}
              required
              className={s.formInput}
            />
            <input
              name="second_name"
              placeholder="Отчество"
              value={form.second_name}
              onChange={handleChange}
              className={s.formInput}
            />
            <input
              name="last_name"
              placeholder="Фамилия"
              value={form.last_name}
              onChange={handleChange}
              className={s.formInput}
            />

            <input
              name="phone"
              placeholder="Телефон"
              value={form.phone}
              onChange={handleChange}
              required
              className={s.formInput}
            />
          </div>

          <input
            name="email"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            required
            className={s.formInput}
          />

          <h3 className={s.subtitle}>Доставка</h3>

          <div className={s.formRow}>
            <label>
              Тип доставки
              <select
                name="deliveryType"
                value={form.deliveryType}
                onChange={handleChange}
                className={s.formSelect}
              >
                <option value="pickup">Самовывоз</option>
                <option value="home_delivery">Доставка</option>
              </select>
            </label>
          </div>

          {/* Самовывоз — выбор магазина */}
          {form.deliveryType === 'pickup' && (
            <div className={s.formRow}>
              <label>
                Магазин самовывоза
                <select
                  name="shopId"
                  value={form.shopId}
                  onChange={handleChange}
                  required
                  className={s.formSelect}
                >
                  <option value="">Выберите магазин</option>
                  {shops.map(shop => (
                    <option key={shop.id} value={shop.id}>
                      {shop.city}, {shop.street}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {/* Курьер — адрес доставки */}
          {form.deliveryType === 'home_delivery' && (
            <>
              <div className={s.formRow}>
                <input
                  name="city"
                  placeholder="Город"
                  value={form.city}
                  onChange={handleChange}
                  required
                  className={s.formInput}
                />
                <input
                  name="street"
                  placeholder="Улица"
                  value={form.street}
                  onChange={handleChange}
                  required
                  className={s.formInput}
                />
              </div>

              <div className={s.formRow}>
                <input
                  name="house"
                  placeholder="Дом"
                  value={form.house}
                  onChange={handleChange}
                  required
                  className={s.formInput}
                />
                <input
                  name="apartment"
                  placeholder="Квартира"
                  value={form.apartment}
                  onChange={handleChange}
                  className={s.formInput}
                />
              </div>

              <div className={s.formRow}>
                <input
                  name="entrance"
                  placeholder="Подъезд"
                  value={form.entrance}
                  onChange={handleChange}
                  className={s.formInput}
                />
                <input
                  name="floor"
                  placeholder="Этаж"
                  value={form.floor}
                  onChange={handleChange}
                  className={s.formInput}
                />
              </div>
            </>
          )}

          <textarea
            name="note"
            placeholder="Комментарий к заказу (необязательно)"
            value={form.note}
            onChange={handleChange}
            rows={3}
            className={s.formTextarea}
          />

          <div className={s.checkoutFooter}>
            <div>
              <span>Итого к оплате: </span>
              <strong className={s.result}>{totalPrice.toLocaleString('ru-RU')} BYN</strong>
            </div>

            <button type="submit" className={s.primary} disabled={loading} style={{marginLeft: 16}}>
              {loading ? 'Переходим к оплате…' : 'Перейти к оплате'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}