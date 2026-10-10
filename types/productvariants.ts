export interface ProductVariantForAdmin {
    id: number
    price: number | string
    sku: string
    active: boolean
    material: {
      name: string
      price_per_mm3: number
    }
  }

  export interface ProductVariantForUserDto {
    id: number
    sku: string
    price: number
    material: {
      id?: number
      name: string
    }
  }