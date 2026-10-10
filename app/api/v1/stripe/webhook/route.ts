import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'
import { DeliveryType, OrderStatus } from '@prisma/client'

export const runtime = 'nodejs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover',
})

function toBigIntOrNull(v?: string | null) {
  const s = (v ?? '').trim()
  if (!s) return null
  if (!/^\d+$/.test(s)) return null
  try { return BigInt(s) } catch { return null }
}

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('Webhook signature error:', err)
    return NextResponse.json({ error: err.message }, { status: 400 })
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true })
  }

  const session = event.data.object as Stripe.Checkout.Session

  try {
    const meta = session.metadata
    if (!meta) throw new Error('No metadata in session')

    const createdBy =
      toBigIntOrNull(session.client_reference_id) ??
      toBigIntOrNull(meta.user_id)

    const items = JSON.parse(meta.items || '[]') as Array<{
      variantId: number
      sku: string
      productName: string
      materialName: string
      price: number
      quantity: number
    }>

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('No items in metadata')
    }

    const total = items.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0)

    const deliveryType: DeliveryType =
      meta.deliveryType === 'home_delivery'
        ? DeliveryType.home_delivery
        : DeliveryType.pickup

    const stripeSessionId = session.id
    const existing = await prisma.orders.findFirst({
      where: { stripe_session_id: stripeSessionId },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json({ received: true })
    }

    // создаём заказ
    const order = await prisma.orders.create({
      data: {
        created_by: createdBy,

        stripe_session_id: stripeSessionId,

        customer_name: meta.name || null,
        customer_second_name: meta.second_name || null,
        customer_last_name: meta.last_name || null,
        customer_email: meta.email || null,
        customer_phone: meta.phone || null,

        delivery_type: deliveryType,
        status: OrderStatus.created,
        note: meta.note || null,

        total_amount: total,
      },
    })

    // адрес (если доставка)
    if (deliveryType === DeliveryType.home_delivery) {
      await prisma.delivery_addresses.create({
        data: {
          order_id: order.id,
          city: meta.city || '',
          street: meta.street || '',
          house: meta.house || '',
          floor: meta.floor || null,
          apartment: meta.apartment || null,
          entrance: meta.entrance || null,
        },
      })
    }

    // позиции заказа
    await prisma.order_items.createMany({
      data: items.map((i) => ({
        order_id: order.id,
        product_variant_id: BigInt(i.variantId),
        unit_price: Number(i.price),
        quantity: Number(i.quantity),
        line_total: Number(i.price) * Number(i.quantity),
      })),
    })

    console.log(' Order created after payment:', String(order.id), 'created_by:', createdBy?.toString() ?? 'null')
    return NextResponse.json({ received: true })
  } catch (e: any) {
    console.error(' Webhook processing error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
