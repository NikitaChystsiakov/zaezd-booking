import DriverMainPage from "@/components/forms/driver/DriverMainPageForm";

export const metadata = {
    title: 'Панель водителя — WebSofa',
    robots: { index: false, follow: false },
}

export default function MainDriverPage() {
    return (
        <section>
            <DriverMainPage />
        </section>
    )
}