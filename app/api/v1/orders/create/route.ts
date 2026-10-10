
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { verifyJwt } from '@/lib/jwt'

const cartItemSchema = z.object({
  productId: z.coerce.number().int().positive(),
  sku: z.string(),
  name: z.string(),
  materialName: z.string(),
  price: z.coerce.number(),
  quantity: z.coerce.number().int().positive(),
  image_path: z.string().nullable().optional(),
})

const checkoutSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(1),
    second_name: z.string().trim().optional(),
    last_name: z.string().trim().optional(),
    phone: z.string().trim().min(11),
    email: z.string().email(),
  }),
  delivery: z.object({
    type: z.enum(['pickup', 'home_delivery']),
    shopId: z.number().int().positive().nullable().optional(),
    address: z
      .object({
        city: z.string(),
        street: z.string(),
        house: z.string(),
        apartment: z.string().nullable().optional(),
        entrance: z.string().nullable().optional(),
        floor: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
  }),
  note: z.string().nullable().optional(),
  items: z.array(cartItemSchema).min(1),
})

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const parsed = checkoutSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Неверные данные', issues: parsed.error.issues },
        { status: 400 }
      )
    }

    const { customer, delivery, items, note } = parsed.data

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    let userIdStr = ''
    const token = (await cookies()).get('auth_token')?.value
    if (token) {
      try {
        const payload: any = await verifyJwt(token)
        userIdStr = String(payload.sub)
      } catch {
        userIdStr = ''
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],

      client_reference_id: userIdStr || undefined,

      line_items: items.map((i) => ({
        price_data: {
          currency: 'byn',
          unit_amount: Math.round(i.price * 100),
          product_data: {
            name: `${i.name} (${i.materialName})`,
            images: i.image_path ? [`${appUrl}${i.image_path}`] : undefined,
          },
        },
        quantity: i.quantity,
      })),

      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/cart`,

      metadata: {
        user_id: userIdStr,

        name: customer.name,
        second_name: customer.second_name ?? '',
        last_name: customer.last_name ?? '',
        phone: customer.phone,
        email: customer.email,

        deliveryType: delivery.type,
        shopId: delivery.shopId ? String(delivery.shopId) : '',

        city: delivery.address?.city ?? '',
        street: delivery.address?.street ?? '',
        house: delivery.address?.house ?? '',
        apartment: delivery.address?.apartment ?? '',
        entrance: delivery.address?.entrance ?? '',
        floor: delivery.address?.floor ?? '',

        note: note ?? '',

        items: JSON.stringify(
          items.map((i) => ({
            variantId: i.productId,
            sku: i.sku,
            productName: i.name,
            materialName: i.materialName,
            price: i.price,
            quantity: i.quantity,
          }))
        ),
      },
    })

    return NextResponse.json({ url: session.url }, { status: 200 })
  } catch (e: any) {
    console.error('order checkout create error', e)
    return NextResponse.json(
      { message: 'Ошибка при создании платежа', details: e?.message },
      { status: 500 }
    )
  }
}