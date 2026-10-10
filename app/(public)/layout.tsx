import Header from '@/components/HeaderServer';
import Footer from '@/components/ui/Footer';
import type { PropsWithChildren } from 'react';

export default function PublicLayout({ children }: PropsWithChildren) {
  return (
    <div className="site">
      <Header />
      <main className="container">{children}</main>
      <Footer />
    </div>
  );
}
