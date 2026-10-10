// types/cart.ts
import type { ProductForUserDto } from './product'
import type { ProductVariantForUserDto } from './productvariants'

export interface CartItem {
  productId: number
  sku: string                 // вариант
  name: string                // название товара
  materialName: string        // материал варианта
  price: number               // цена за 1 шт
  quantity: number
  image_path?: string | null
}

export interface AddToCartInput {
  product: ProductForUserDto
  variant: ProductVariantForUserDto
  quantity?: number
}
