import { z } from 'zod'
import { ProductCategory } from '@prisma/client'

export const materialInputSchema = z.object({
  id: z.coerce.number().int().positive('Некорректный ID материала'),
  price_per_mm3: z.coerce.number().positive('Цена материала должна быть больше 0').optional(),
})

export const createProductSchema = z.object({
  name: z.string().trim().min(3, 'Название обязательно и должно быть не короче 3 символов'),
  description: z.string().trim().min(1, 'Описание обязательно'),              
  category: z.nativeEnum(ProductCategory).refine(
    val => Object.values(ProductCategory).includes(val),
    { message: 'Укажите корректную категорию' }
  ),  
  width_mm:  z.coerce.number().int().positive('Ширина должна быть больше 0'),
  height_mm: z.coerce.number().int().positive('Высота должна быть больше 0'),
  depth_mm:  z.coerce.number().int().positive('Глубина должна быть больше 0'),
  base_price: z.coerce.number().int().positive('Стоимость должна быть больше 0'),
  materials: z.array(materialInputSchema).min(1, 'Выберите хотя бы один материал'),
  image: z
    .any()
    .refine(
      (file) => !file || file instanceof File || file === null,
      'Некорректный тип файла'
    )
    .optional()
})

export type CreateProductDto = z.infer<typeof createProductSchema>
