import s from './ManagerMainPage.module.css'

export default async function ManagerMainPage() {
  return (
    <section className={s.wrapper}>
      <h1 className={s.title}>Панель менеджера</h1>
      <p className={s.subtitle}>Выберите раздел для управления:</p>

      <div className={s.grid}>
      <a href="/manager/stock" className={s.card}>
          <h3>Склад магазина</h3>
          <p>Просмотр остатков магазина</p>
        </a>
        <a href="/manager/orders/list" className={s.card}>
          <h3>Список заказов</h3>
          <p>Просмотр заказов</p>
        </a>
        <a href="/manager/orders/create" className={s.card}>
          <h3>➕ Создать заказ</h3>
          <p>Создание нового заказа</p>
        </a>
      </div>
    </section>
  )
}
