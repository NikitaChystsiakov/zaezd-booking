import s from './DriverMainPageForm.module.css'

export default async function DriverMainPage() {
    return (
        <section className={s.wrapper}>
            <h1 className={s.title}>Панель водителя</h1>
            <p className={s.subtitle}>Выберите раздел для управления:</p>
            <div className={s.grid}>
                <a href="/driver/active" className={s.card}>
                    <h3>Мои доставки</h3>
                    <p>Состояние взятых доставок</p>
                </a>
                <a href="/driver/list" className={s.card}>
                    <h3>Выбрать заказ</h3>
                    <p>Выбор заказов для доставки</p>
                </a>
                <a href="/driver/history" className={s.card}>
                    <h3>История доставок</h3>
                    <p>Просмотр выполненных доставок</p>
                </a>
            </div>
        </section>
    )
}
