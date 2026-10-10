import AdminMainPage from "@/components/forms/admin/AdminMainPageForm";

export const metadata = {
    title: 'Админ-панель — WebSofa',
    robots: { index: false, follow: false },
}

export default function MainAdminPage() {
    return (
        <section>
            <AdminMainPage />
        </section>
    )
}