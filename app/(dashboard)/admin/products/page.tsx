import AdminProductsList from '@/components/forms/admin/AdminProductList'

export const metadata = {
  title: 'Просмотр товаров — Панель администратора',
  robots: { index: false, follow: false },
  alternates: { canonical: '/admin/products' },
}

export default function AdminViewProductsPage() {
  return (

      <AdminProductsList />

  )
}

