import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { verifyJwt } from '@/lib/jwt'
import { generateInvoicePdfBySessionId } from '@/lib/invoice'

export const runtime = 'nodejs'

export async function GET(_req: Request, context: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await context.params

    let oid: bigint
    try {
      oid = BigInt(orderId)
    } catch {
      return NextResponse.json({ message: 'Bad orderId' }, { status: 400 })
    }

    const token = (await cookies()).get('auth_token')?.value
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const payload: any = await verifyJwt(token)
    const userId = BigInt(payload.sub)

    const order = await prisma.orders.findFirst({
      where: { id: oid, created_by: userId },
      select: { stripe_session_id: true },
    })

    if (!order) return NextResponse.json({ message: 'Not found' }, { status: 404 })
    if (!order.stripe_session_id) {
      return NextResponse.json({ message: 'Receipt not ready' }, { status: 409 })
    }

    const pdfBytes = await generateInvoicePdfBySessionId(order.stripe_session_id)
    // Приводим Uint8Array к ArrayBuffer, который поддерживается в BodyInit
    const pdfBuffer = pdfBytes.buffer as ArrayBuffer

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="PaymentReceipt.pdf"`,
      },
    })
  } catch (e: any) {
    console.error('receipt error:', e)
    return NextResponse.json({ message: 'Ошибка генерации чека' }, { status: 500 })
  }
}
