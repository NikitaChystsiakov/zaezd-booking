import AdminMaterialList from '@/components/forms/admin/AdminMaterialList'

export const metadata = {
  title: 'Просмотр материалов — Панель администратора',
  robots: { index: false, follow: false },
  alternates: { canonical: '/admin/products' },
}

export default function AdminViewMaterialPage() {
  return (
      <AdminMaterialList/>
  )
}