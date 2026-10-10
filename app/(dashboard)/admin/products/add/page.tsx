import ProductForm from '@/components/forms/admin/AddProductForm'

export const metadata = {
  title: 'Добавление товаров — Панель администратора',
  robots: { index: false, follow: false },
  alternates: { canonical: '/admin/products' },
}

export default function AdminAddProductsPage() {
  return (
    
      <ProductForm />
  
  )
}
