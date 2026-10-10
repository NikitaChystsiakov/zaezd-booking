import type { Metadata } from 'next';
import RegisterForm from '@/components/forms/register/RegisterForm';

export const metadata: Metadata = {
  title: 'Регистрация — WebSofa',
  description: 'Создание аккаунта клиента Timber&Grain.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/register' },
  openGraph: { url: '/register' },
};

export default function RegisterPage() {
  return (
    <section>
      <RegisterForm />
    </section>
  );
}
