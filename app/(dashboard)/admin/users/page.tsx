import AdminUsersPage  from '@/components/forms/admin/AdminUsersPage'


export const metadata = {
    title: 'Пользователи - Панель администратора',
    robots: { index: false, follow: false },
}

export default function UserListPage() {
    return (
        <section>
            <AdminUsersPage />
        </section>
    )
}