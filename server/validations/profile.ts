import { z } from 'zod'

export const updateProfileSchema = z.object({
  first_name: z.string().trim().min(1).max(100).nullable().optional(),
  second_name: z.string().trim().min(1).max(100).nullable().optional(),
  last_name: z.string().trim().min(1).max(100).nullable().optional(),
  phone: z.string().trim()
    .max(20)
    .nullable()
    .optional()
    .refine(
      (val) => !val || val === '' || /^\+375(29|33|44|25|17|16|21|22|23|24|15|99)\d{7}$/.test(val),
      {
        message: 'Номер телефона должен быть в формате +375XXXXXXXXX'
      }
    ),
})

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;