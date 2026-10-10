'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useToast } from '@/hooks/useToast'
import { createProductSchema, type CreateProductDto } from '@/server/validations/product'
import type { MaterialsForProductAdding } from '@/types/material'
import s from './AddProductForm.module.css'

export default function AddProductForm() {
  const [form, setForm] = useState<CreateProductDto>({
    name: '',
    description: '',
    category: 'CHAIR',
    width_mm: 0,
    height_mm: 0,
    depth_mm: 0,
    base_price: 0,
    materials: [],
    image: null,
  })

  const [materialsList, setMaterialsList] = useState<MaterialsForProductAdding[]>([])
  const [loading, setLoading] = useState(false)
  const { show } = useToast()

  useEffect(() => {
    async function loadMaterials() {
      try {
        const res = await fetch('/api/v1/admin/materials')
        if (!res.ok) throw new Error('Ошибка при загрузке материалов')
        const data = await res.json()
        setMaterialsList(data)
      } catch (err) {
        console.error(err)
        show({
          title: 'Ошибка',
          description: 'Не удалось загрузить материалы',
          duration: 5000,
        })
      }
    }
    loadMaterials()
  }, [show])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const parsed = createProductSchema.safeParse(form)
    if (!parsed.success) {
      show({
        title: 'Ошибка',
        description: parsed.error.issues[0]?.message ?? 'Некорректно заполнены поля',
        duration: 6000,
      })
      return
    }

    const fd = new FormData()
    Object.entries(parsed.data).forEach(([key, val]) => {
      if (key === 'materials') {
        fd.append('materials', JSON.stringify(val))
      } else if (key === 'image' && val instanceof File) {
        fd.append('image', val)
      } else if (val !== null && val !== undefined) {
        fd.append(key, String(val))
      }
    })

    setLoading(true)
    try {
      const res = await fetch('/api/v1/admin/products/create', {
        method: 'POST',
        body: fd,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Ошибка при добавлении товара')

      show({ title: 'Успешно', description: 'Товар успешно добавлен', duration: 5000 })
      setForm({
        name: '',
        description: '',
        category: 'CHAIR',
        width_mm: 0,
        height_mm: 0,
        depth_mm: 0,
        base_price: 0,
        materials: [],
        image: null,
      })
    } catch (err) {
      show({
        title: 'Ошибка',
        description: err instanceof Error ? err.message : 'Неизвестная ошибка',
        duration: 6000,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={s.wrapper}>
      <div className={s.card}>
        <h2 className={s.title}>Добавление нового товара</h2>
        <form className={s.form} onSubmit={handleSubmit}>
          <label className={s.field}>
            <span className={s.label}>Название</span>
            <input
              className={s.input}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>

          <label className={s.field}>
            <span className={s.label}>Описание</span>
            <textarea
              className={s.textarea}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
            />
          </label>

          <label className={s.field}>
            <span className={s.label}>Категория</span>
            <select
              className={s.input}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as any })}
            >
              <option value="CHAIR">Стул</option>
              <option value="TABLE">Стол</option>
              <option value="BED">Кровать</option>
              <option value="SOFA">Диван</option>
              <option value="PUFF">Пуфф</option>
              <option value="ARMCHAIR">Кресло</option>
              <option value="OTHER">Другое</option>
            </select>
          </label>

          <div className={s.dimensions}>
            {[
              { label: 'Ширина (см)', key: 'width_mm' },
              { label: 'Высота (см)', key: 'height_mm' },
              { label: 'Глубина (см)', key: 'depth_mm' },
            ].map(({ label, key }) => (
              <label key={key} className={s.field}>
                <span className={s.label}>{label}</span>
                <input
                  type="number"
                  className={s.input}
                  value={(form as any)[key]}
                  onChange={(e) =>
                    setForm({ ...form, [key]: Number(e.target.value) })
                  }
                  required
                />
              </label>
            ))}

            <label className={s.field}>
              <span className={s.label}>Базовая цена (BYN)</span>
              <input
                type="number"
                className={s.input}
                value={form.base_price}
                onChange={(e) =>
                  setForm({ ...form, base_price: Number(e.target.value) })
                }
                required
              />
            </label>

            <label className={s.field}>
              <span className={s.label}>Изображение</span>
              <input
                className={s.pick}
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setForm({ ...form, image: e.target.files?.[0] ?? null })
                }
              />
            </label>
          </div>

          <fieldset className={s.materialsFieldset}>
            <span className={s.label}>Материалы</span>
            <div className={s.materialsGrid}>
              {materialsList.map((m) => {
                const checked = form.materials.some((sel) => sel.id === m.id)
                return (
                  <label
                    key={m.id}
                    className={`${s.materialCard} ${checked ? s.materialCard__selected : ''
                      }`}
                  >
                    <input
                      type="checkbox"
                      className={s.checkboxNative}
                      checked={checked}
                      onChange={() => {
                        const exists = form.materials.find(
                          (sel) => sel.id === m.id
                        )
                        setForm({
                          ...form,
                          materials: exists
                            ? form.materials.filter((sel) => sel.id !== m.id)
                            : [
                              ...form.materials,
                              { id: m.id, price_per_mm3: m.price_per_mm3 },
                            ],
                        })
                      }}
                    />

                    <span className={s.materialContent}>
                      <span className={s.materialName}>{m.name}</span>
                      {'price_per_m3' in m && m.price_per_m3 != null && (
                        <span className={s.materialMeta}>
                          {Number(m.price_per_m3).toLocaleString('ru-BY', {
                            style: 'currency',
                            currency: 'BYN',
                            maximumFractionDigits: 2,
                          })}{' '}
                          <span className={s.perUnit}>/ см</span>
                        </span>
                      )}
                    </span>

                    <span aria-hidden className={s.checkmark} />
                  </label>
                )
              })}
            </div>
          </fieldset>

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Добавляем…' : 'Добавить товар'}
          </button>
        </form>
      </div>
    </div>
  )
}
