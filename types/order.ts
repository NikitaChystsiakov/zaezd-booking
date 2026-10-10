export type UserOrderItemInfo = {
  name: string
  material: string
  quantity: number
  line_total: number
}

export type UserOrderInfo = {
  id: number                 
  created_at: string
  total: number
  status: OrderStatus
  items: UserOrderItemInfo[]
  invoice_available: boolean
}

export type OrderStatus =
  | 'created'
  | 'in_production'
  | 'ready_to_ship'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'
  
export type DeliveryType = 'pickup' | 'home_delivery'

export type OrderItem = {
  id: number
  quantity: number
  unit_price: number
  line_total: number
  productVariant?: {
    sku: string
    product?: { name: string }
    material?: { name: string }
  } | null
}

export type Order = {
  id: number
  created_at: string
  customer_name: string | null
  customer_second_name: string | null
  customer_last_name: string | null
  customer_phone: string | null
  customer_email: string | null
  delivery_type: DeliveryType
  status: OrderStatus
  note: string | null
  total_amount: number
  address?: {
    city: string
    street: string
    house: string
    apartment?: string | null
    entrance?: string | null
    floor?: string | null
  } | null
  shop?: { id: number; city: string; street: string } | null
  items: OrderItem[]
}

export type AdminOrdersResponse = {
  page: number
  pageSize: number
  total: number
  orders: Order[]
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  created: 'Создан',
  in_production: 'В производстве',
  ready_to_ship: 'Подготовлен',
  in_transit: 'В пути',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
}

export const DELIVERY_LABEL: Record<DeliveryType, string> = {
  pickup: 'Самовывоз',
  home_delivery: 'Доставка',
}

export function formatMoney(n: number) {
  return (Number.isFinite(n) ? n : 0).toLocaleString('ru-RU') + ' BYN'
}
