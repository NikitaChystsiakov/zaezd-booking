import type { Metadata } from 'next';
import LoginForm from '@/components/forms/login/LoginForm';

export const metadata: Metadata = {
  title: 'Войти — WebSofa',
  description: 'Авторизация в личном кабинете Timber&Grain.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/login' },
  openGraph: { url: '/login' },
};

export default function LoginPage() {
  return (
    <section>
      <LoginForm />
    </section>
  );
}
