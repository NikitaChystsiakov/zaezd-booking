import Header from '@/components/HeaderServer'
import Footer from '@/components/ui/Footer'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyJwt } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'
import type { PropsWithChildren } from 'react'

export default async function DashboardLayout({ children }: PropsWithChildren) {
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
    select: { role: true },
  })

  if (!user) redirect('/login')

  return (
      <div className="site">
        <Header />
        <main className="container">{children}</main>
        <Footer />
      </div>
  )
}
