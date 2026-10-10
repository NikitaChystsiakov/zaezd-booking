import type { ProductVariantForAdmin, ProductVariantForUserDto } from './productvariants'

export interface ProductForUserDto {
  id: number
  name: string
  description: string
  category: string          
  width_mm: number
  height_mm: number
  depth_mm: number
  base_price: number        
  image_path?: string | null
  variants: ProductVariantForUserDto[]
}

export interface Product {
  id: number
  name: string
  description: string
  category: string
  width_mm: number
  height_mm: number
  depth_mm: number
  base_price: number         
  image_path?: string | null
  active: boolean
  variants: ProductVariantForAdmin[]
}

export interface ProductModalProps {
  product: ProductForUserDto
  selectedSku: string
  setSelectedSku: (sku: string) => void
  selectedVariant?: ProductForUserDto['variants'][0]
  onAddToCart: () => void
  onClose: () => void
}