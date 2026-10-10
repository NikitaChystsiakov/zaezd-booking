import ManagerMainPage from "@/components/forms/manager/ManagerMainPage";

export const metadata = {
    title: 'Менеджер-панель — WebSofa',
    robots: { index: false, follow: false },
}

export default function MainManagerPage() {
    return (
        <section>
            <ManagerMainPage />
        </section>
    )
}