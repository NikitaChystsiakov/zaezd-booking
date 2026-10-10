import HeaderClient from '@/components/ui/Header'
import { cookies } from 'next/headers'
import { verifyJwt } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'

export default async function HeaderServer() {
  const token = (await cookies()).get('auth_token')?.value
  let session = null

  if (token) {
    try {
      const payload = await verifyJwt(token)
      const user = await prisma.users.findUnique({
        where: { id: BigInt(payload.sub) },
        select: { id: true, role: true, first_name: true },
      })
      if (user) session = user
    } catch {
      
    }
  }

  return <HeaderClient session={session} />
}
