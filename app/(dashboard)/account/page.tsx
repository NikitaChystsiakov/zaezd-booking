import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyJwt } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'
import ProfileForm from '@/components/forms/account/ProfileForm'
import UserOrders from '@/components/forms/account/UserOrders'
import s from './AccountPage.module.css'

export const metadata = {
  title: 'Личный кабинет — WebSofa',
  robots: { index: false, follow: false },
  alternates: { canonical: '/account' },
}

export default async function AccountPage() {
  const token = (await cookies()).get('auth_token')?.value
  if (!token) redirect('/login')

  let payload: any
  try {
    payload = await verifyJwt(token)
  } catch {
    redirect('/login')
  }

  const user = await prisma.users.findUnique({
    where: { id: BigInt(payload.sub) },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      second_name: true,
      email: true,
      phone: true,
      role: true,
    },
  })

  if (!user) redirect('/login')

  return (
    <section className={s.wrapper}>
      <div className={s.columns}>
        <ProfileForm user={user} />
        <UserOrders />
      </div>
    </section>
  )
}
