import type { Metadata } from 'next';
import CatalogPage from "@/components/forms/catalog/CatalogPage"

export const metadata: Metadata = {
  title: 'Каталог — WebSofa',
  description: 'Просмотр ассортимента Timber&Grain.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/products' },
  openGraph: { url: '/products' },
};

export default function ProductPage() {
  return (
    <section>
      <CatalogPage/>
    </section>
  );
}