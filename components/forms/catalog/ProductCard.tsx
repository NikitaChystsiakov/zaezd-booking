'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import type { ProductForUserDto } from '@/types/product'
import ProductModal from './ProductModal'
import { useCart } from '@/components/cart/CartProvider'
import s from './CatalogPage.module.css'

type ProductCardProps = {
  product: ProductForUserDto
}

export default function ProductCard({ product }: ProductCardProps) {
  const variants = product.variants ?? []
  const [selectedSku, setSelectedSku] = useState<string>(variants[0]?.sku ?? '')
  const [isOpen, setIsOpen] = useState(false)
  const { addItem } = useCart()

  const selectedVariant = useMemo(
    () => variants.find((v) => v.sku === selectedSku),
    [variants, selectedSku]
  )

  const handleAddToCart = () => {
    if (!selectedVariant) return
    addItem({ product, variant: selectedVariant, quantity: 1 })
  }

  const imageSrc =
    product.image_path && product.image_path.length > 0
      ? product.image_path.startsWith('/')
        ? product.image_path
        : `/uploads/products/${product.image_path}`
      : null

  return (
    <>
      <article className={s.card} onClick={() => setIsOpen(true)}>
        <div className={s.cardImageWrapper}>
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={product.name}
              fill
              className={s.cardImage}
              sizes="(min-width: 1200px) 260px, 50vw"
            />
          ) : (
            <div className={s.cardImagePlaceholder}>Нет фото</div>
          )}
        </div>

        <div className={s.cardMain}>
        <h3 className={s.productTitle}>{product.name}</h3>
          <span className={s.cardMeta}>{product.category}</span>
          <div className={s.dimensions}>
            {product.width_mm}×{product.height_mm}×{product.depth_mm} cм
          </div>
        </div>

        <div className={s.cardFooter}>
          {selectedVariant && (
            <div className={s.price}>
              {selectedVariant.price.toLocaleString('ru-RU')} BYN
            </div>
          )}
        </div>
      </article>

      {isOpen && (
        <ProductModal
          product={product}
          selectedSku={selectedSku}
          setSelectedSku={setSelectedSku}
          selectedVariant={selectedVariant}
          onClose={() => setIsOpen(false)}
          onAddToCart={handleAddToCart}
        />
      )}
    </>
  )
}
