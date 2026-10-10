'use client'

import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import s from './CatalogPage.module.css'
import type { ProductModalProps } from '@/types/product'
import { useToast } from '@/hooks/useToast'

export default function ProductModal({
  product,
  selectedSku,
  setSelectedSku,
  selectedVariant,
  onAddToCart,
  onClose,
}: ProductModalProps) {
  const variants = product.variants ?? []
  const toast = useToast()

  const imageSrc =
    product.image_path && product.image_path.length > 0
      ? product.image_path.startsWith('/')
        ? product.image_path
        : `/uploads/products/${product.image_path}`
      : null

      const handleAddToCart = () => {
        onAddToCart()

        toast.show({
          title: 'Товар добавлен в корзину',
          description: `${product.name}${selectedVariant ? ` (${selectedVariant.material.name})` : ''}`,
          duration: 3000,
        })

        onClose()
      }

  return (
    <AnimatePresence>
      <div className={s.modalOverlay} onClick={onClose}>
        <motion.div
          className={s.modalCard}
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 30 }}
          transition={{ duration: 0.25 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className={s.modalClose} onClick={onClose}>
            ✕
          </button>

          {imageSrc && (
            <div className={s.modalImageWrapper}>
              <Image
                src={imageSrc}
                alt={product.name}
                width={800}
                height={600}
                className={s.modalImage}
                priority
              />
            </div>
          )}

          <h3 className={s.modalTitle}>{product.name}</h3>
          <p className={s.muted}>{product.category}</p>
          <p className={s.desc}>{product.description}</p>

          <div className={s.dimensions}>
            Размеры: {product.width_mm}×{product.height_mm}×{product.depth_mm} cм
          </div>

          <label className={s.label}>Материал:</label>
          <select
            className={s.select}
            value={selectedSku}
            onChange={(e) => setSelectedSku(e.target.value)}
          >
            {variants.map((v) => (
              <option key={v.sku} value={v.sku}>
                {v.material.name}
              </option>
            ))}
          </select>

          {selectedVariant && (
            <div className={s.priceLarge}>
              {selectedVariant.price.toLocaleString('ru-RU')} BYN
            </div>
          )}

          <button className={s.btnLarge}  onClick={handleAddToCart}
            disabled={!selectedVariant}>
            Добавить в корзину
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
