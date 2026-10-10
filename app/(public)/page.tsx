import Image from 'next/image'
import Link from 'next/link'
import type { FC } from 'react'
import PromoCard from '@/components/forms/home/PromoCard'
import s from './HomePage.module.css'

const HomePage: FC = () => {
  const features = [
    {
      title: 'Гарантия 2 года',
      description: 'Официальная гарантия на всю продукцию'
    },
    {
      title: 'Быстрое изготовление',
      description: 'Собственное производство - от 7 до 14 дней'
    },
    {
      title: 'Бесплатная доставка',
      description: 'Бесплатная доставка по всем областным центрам'
    },
  ]

  const testimonials = [
    {
      name: 'Анна Ляпкина',
      role: 'Дизайнер интерьера',
      text: 'Работаю с этой компанией уже 3 года. Качество мебели отличное, сроки всегда соблюдаются, клиенты довольны.',
      rating: 5,
      date: '15.12.2023'
    },
    {
      name: 'Дмитрий Ляточевский',
      role: 'Постоянный клиент',
      text: 'Заказывал угловой диван для гостиной. Сделали точно по указанным размерам, доставили вовремя. Рекомендую!',
      rating: 5,
      date: '02.11.2023'
    },
    {
      name: 'Екатерина Федорович',
      role: 'Владелец кафе',
      text: 'Обставили все наше новое кафе. Мебель качественная, стильная и очень практичная. Спасибо!',
      rating: 5,
      date: '25.10.2023'
    }
  ]

  const stats = [
    { value: '5+', label: 'Лет на рынке' },
    { value: '1000+', label: 'Довольных клиентов' },
    { value: '24/7', label: 'Поддержка' },
    { value: '14', label: 'Дней изготовление' }
  ]

  const steps = [
    {
      number: '1',
      title: 'Выбор модели',
      description: 'Выберите модель в каталоге или проконсультируйтесь с менеджером'
    },
    {
      number: '2',
      title: 'Конфигурация',
      description: 'Подберите материал и размеры под ваш интерьер'
    },
    {
      number: '3',
      title: 'Изготовление',
      description: 'Мы изготавливаем мебель на собственном производстве'
    },
    {
      number: '4',
      title: 'Доставка',
      description: 'Бесплатная доставка и сборка у вас дома'
    }
  ]

  return (
    <div className={s.container}>
      <section className={s.hero}>
        <div className={`card ${s.heroCard}`}>
          <div className={s.heroText}>
            <h1 className={s.heroTitle}>
              Мебель <span className={s.highlight}>под ваш интерьер</span>
            </h1>
            <p className={s.heroSubtitle}>
              Выбирайте ткань и цвет — мы изготовим и доставим. Можно забрать в удобном магазине.
            </p>
            <div className={s.heroActions}>
              <Link className={s.primaryButton} href="/products">
                Перейти в каталог
              </Link>
              <Link className={s.secondaryButton} href="/about">
                Контакты
              </Link>
            </div>
            <div className={s.heroStats}>
              {stats.map((stat, index) => (
                <div key={index} className={s.statItem}>
                  <span className={s.statValue}>{stat.value}</span>
                  <span className={s.statLabel}>{stat.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={s.heroImage}>
            <Image
              src="/hero.jpg"
              alt="Диван в современном интерьере"
              width={640}
              height={420}
              priority
              className={s.heroImg}
            />
          </div>
        </div>

        <PromoCard />
      </section>

      {/* Особенности */}
      <section className={s.features}>
        <div className={s.sectionHeader}>
          <h2 className={s.sectionTitle}>Почему выбирают нас</h2>
          <p className={s.sectionSubtitle}>Мы делаем мебель, которая становится частью вашего дома</p>
        </div>
        <div className={s.featuresGrid}>
          {features.map((feature, index) => (
            <div key={index} className={s.featureCard}>
              <div className={s.featureIcon}>
                <span className={s.iconNumber}>0{index + 1}</span>
              </div>
              <h3 className={s.featureTitle}>{feature.title}</h3>
              <p className={s.featureDescription}>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Как это работает */}
      <section className={s.howItWorks}>
        <div className={s.sectionHeader}>
          <h2 className={s.sectionTitle}>Как это работает</h2>
          <p className={s.sectionSubtitle}>4 простых шага к мебели вашей мечты</p>
        </div>
        <div className={s.steps}>
          {steps.map((step, index) => (
            <div key={index} className={s.step}>
              <div className={s.stepNumber}>{step.number}</div>
              <div className={s.stepContent}>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
              {index < steps.length - 1 && <div className={s.stepConnector}></div>}
            </div>
          ))}
        </div>
      </section>

      {/* Отзывы */}
      <section className={s.testimonials}>
        <div className={s.sectionHeader}>
          <h2 className={s.sectionTitle}>Отзывы клиентов</h2>
          <p className={s.sectionSubtitle}>Что говорят о нас наши клиенты</p>
        </div>
        <div className={s.testimonialsGrid}>
          {testimonials.map((testimonial, index) => (
            <div key={index} className={s.testimonialCard}>
              <div className={s.testimonialHeader}>
                <div className={s.testimonialAvatar}>
                  <span className={s.avatarIcon}>👤</span>
                </div>
                <div className={s.testimonialInfo}>
                  <h4>{testimonial.name}</h4>
                  <span>{testimonial.role}</span>
                </div>
                <div className={s.testimonialRating}>
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <span key={i} className={s.starIcon}>★</span>
                  ))}
                </div>
              </div>
              <p className={s.testimonialText}>"{testimonial.text}"</p>
              <div className={s.testimonialDate}>{testimonial.date}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default HomePage