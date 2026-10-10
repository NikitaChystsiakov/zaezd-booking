import { NextResponse } from 'next/server'
import { generateInvoicePdfBySessionId } from '@/lib/invoice'

export const runtime = 'nodejs'

export async function GET(_req: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await context.params
    if (!sessionId) return NextResponse.json({ error: 'Missing session ID' }, { status: 400 })

    const pdfBytes = await generateInvoicePdfBySessionId(sessionId)
    const pdfBuffer = pdfBytes.buffer as ArrayBuffer

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="PaymentReceipt.pdf"`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 })
  }
}
