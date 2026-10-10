'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import s from './AdminMaterialsList.module.css'
import { useToast } from '@/hooks/useToast'
import type { Material } from '@/types/material'
import type { Draft } from '@/types/material'
import Link from 'next/link'

const emptyDraft: Draft = { name: '', color: '#000000', price_per_mm3: '0', active: true }

export default function AdminMaterialList() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [create, setCreate] = useState<Draft>(emptyDraft)

  const [mounted, setMounted] = useState(false)
  const [editing, setEditing] = useState<Material | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)

  const toast = useToast()

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/admin/materials', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || 'Не удалось загрузить материалы')
      setMaterials(Array.isArray(data) ? data : [])
    } catch (e: any) {
      toast.show({
        title: 'Ошибка',
        description: e?.message ?? 'Ошибка загрузки материалов',
        duration: 5000,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
    load()
  }, [])

  function openEdit(m: Material) {
    setEditing(m)
    setDraft({
      name: m.name ?? '',
      color: m.color ?? '#000000',
      price_per_mm3: String(m.price_per_mm3 ?? 0),
      active: !!m.active,
    })
  }

  function closeEdit() {
    if (saving) return
    setEditing(null)
    setDraft(null)
  }

  useEffect(() => {
    if (!editing) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeEdit()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    
  }, [editing, saving])

  async function createMaterial(e: React.FormEvent) {
    e.preventDefault()

    try {
      setSaving(true)
      const res = await fetch('/api/v1/admin/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: create.name,
          color: create.color,
          price_per_mm3: create.price_per_mm3,
          active: create.active,
        }),
      })
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data?.message || 'Не удалось создать материал')
      }

      const created: Material = data.material ?? data
      setMaterials((prev) => [created, ...prev].sort((a, b) => a.id - b.id))
      setCreate(emptyDraft)
      
      toast.show({
        title: 'Успешно',
        description: 'Материал создан',
        duration: 3000,
      })
    } catch (e: any) {
      toast.show({
        title: 'Ошибка создания',
        description: e?.message ?? 'Не удалось создать материал',
        duration: 5000,
      })
    } finally {
      setSaving(false)
    }
  }

  async function saveEdit() {
    if (!editing || !draft) return

    try {
      setSaving(true)
      const res = await fetch(`/api/v1/admin/materials/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          color: draft.color,
          price_per_mm3: draft.price_per_mm3,
          active: draft.active,
        }),
      })
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data?.message || 'Не удалось обновить материал')
      }

      const updated: Material = data.material ?? data
      setMaterials((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
      closeEdit()
      
      toast.show({
        title: 'Успешно',
        description: 'Материал обновлен',
        duration: 3000,
      })
    } catch (e: any) {
      toast.show({
        title: 'Ошибка обновления',
        description: e?.message ?? 'Не удалось обновить материал',
        duration: 5000,
      })
    } finally {
      setSaving(false)
    }
  }

  const modal =
    editing && draft ? (
      <div className={s.modalOverlay} onMouseDown={closeEdit}>
        <div className={s.modalCard} onMouseDown={(e) => e.stopPropagation()}>
          <div className={s.modalHeader}>
            <div>
              <div className={s.modalTitle}>Редактирование материала</div>
              <div className={s.modalSubtitle}>ID: {editing.id}</div>
            </div>
            <button className={s.iconBtn} onClick={closeEdit} aria-label="Close">
              ✕
            </button>
          </div>

          <div className={s.formGrid}>
            <div className={s.field}>
              <label>Название</label>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>

            <div className={s.field}>
              <label>Цвет</label>
              <div className={s.colorRow}>
                <input
                  type="color"
                  value={draft.color}
                  onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                />
                <input
                  value={draft.color}
                  onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                  placeholder="#RRGGBB"
                />
              </div>
            </div>

            <div className={s.field}>
              <label>Цена за см</label>
              <input
                inputMode="decimal"
                value={draft.price_per_mm3}
                onChange={(e) => setDraft({ ...draft, price_per_mm3: e.target.value })}
                placeholder="0.00000"
              />
            </div>

            <div className={s.fieldInline} style={{ gridColumn: '1 / -1' }}>
              <label className={s.checkbox}>
                <input
                  id="mat_active"
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                />
              </label>
              <label htmlFor="mat_active">Активен</label>
            </div>
          </div>

          <div className={s.modalActions}>
            <button className={s.secondaryBtn} disabled={saving} onClick={closeEdit}>
              Отмена
            </button>
            <button className={s.primaryBtn} disabled={saving} onClick={saveEdit}>
              {saving ? 'Сохраняю…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    ) : null

  return (
    <div className={s.wrapper}>
      <div className={s.card}>
        <div className={s.headerRow}>
          <h2 className={s.title}>Материалы</h2>
          <Link className={s.secondaryBtn} href="/admin">
              ← Назад
            </Link>
          <button className={s.secondaryBtn} onClick={load} disabled={loading}>
            {loading ? 'Загрузка...' : 'Обновить'}
          </button>
        </div>

        <form className={s.createForm} onSubmit={createMaterial}>
          <div className={s.createGrid}>
            <div className={s.field}>
              <label>Название</label>
              <input
                value={create.name}
                onChange={(e) => setCreate({ ...create, name: e.target.value })}
                placeholder="Напр. Кожа"
                required
              />
            </div>

            <div className={s.field}>
              <label>Цвет</label>
              <div className={s.colorRow}>
                <input
                  type="color"
                  value={create.color}
                  onChange={(e) => setCreate({ ...create, color: e.target.value })}
                />
                <input
                  value={create.color}
                  onChange={(e) => setCreate({ ...create, color: e.target.value })}
                  placeholder="#RRGGBB"
                />
              </div>
            </div>

            <div className={s.field}>
              <label>Цена за см</label>
              <input
                inputMode="decimal"
                value={create.price_per_mm3}
                onChange={(e) => setCreate({ ...create, price_per_mm3: e.target.value })}
                placeholder="0.00000"
                required
              />
            </div>

            <div className={s.fieldInline}>
              <label className={s.checkbox}>
                <input
                  id="create_active"
                  type="checkbox"
                  checked={create.active}
                  onChange={(e) => setCreate({ ...create, active: e.target.checked })}
                />
              </label>
              <label htmlFor="create_active">Активен</label>
            </div>

            <button className={s.primaryBtn} type="submit" disabled={saving}>
              {saving ? 'Добавляю…' : 'Добавить'}
            </button>
          </div>
        </form>

        {loading ? (
          <p className={s.muted}>Загрузка…</p>
        ) : (
          <>
            <div className={s.tableWrapper}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Название</th>
                    <th>Цвет</th>
                    <th>Цена/см</th>
                    <th>Статус</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m) => (
                    <tr key={m.id}>
                      <td>{m.id}</td>
                      <td className={s.nameCell}>{m.name}</td>
                      <td>
                        <div className={s.colorCell}>
                          <span className={s.colorDot} style={{ background: m.color }} />
                          <span className={s.mono}>{m.color}</span>
                        </div>
                      </td>
                      <td className={s.mono}>{Number(m.price_per_mm3).toFixed(4)}</td>
                      <td>
                        <span className={m.active ? s.badgeActive : s.badgeInactive}>
                          {m.active ? 'Активен' : 'Выключен'}
                        </span>
                      </td>
                      <td className={s.actionsCell}>
                        <button className={s.editBtn} onClick={() => openEdit(m)}>
                          Редактировать
                        </button>
                      </td>
                    </tr>
                  ))}
                  {materials.length === 0 && (
                    <tr>
                      <td colSpan={6} className={s.emptyRow}>
                        Материалов пока нет
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Мобильные карточки */}
            <div className={s.mobileList}>
              {materials.map((m) => (
                <div key={m.id} className={s.materialCard}>
                  <div className={s.materialHeader}>
                    <div>
                      <div className={s.materialName}>{m.name}</div>
                      <div className={s.materialId}>ID: {m.id}</div>
                    </div>
                    <div className={s.materialStatus}>
                      <span className={m.active ? s.badgeActive : s.badgeInactive}>
                        {m.active ? 'Активен' : 'Выключен'}
                      </span>
                    </div>
                  </div>
                  
                  <div className={s.materialDetails}>
                    <div className={s.detailRow}>
                      <span className={s.detailLabel}>Цвет:</span>
                      <div className={s.colorCell}>
                        <span className={s.colorDot} style={{ background: m.color }} />
                        <span className={s.detailValue}>{m.color}</span>
                      </div>
                    </div>
                    <div className={s.detailRow}>
                      <span className={s.detailLabel}>Цена/см:</span>
                      <span className={s.detailValue}>{Number(m.price_per_mm3).toFixed(4)}</span>
                    </div>
                  </div>
                  
                  <div className={s.materialActions}>
                    <button className={s.editBtn} onClick={() => openEdit(m)}>
                      Редактировать
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {mounted && modal ? createPortal(modal, document.body) : null}
    </div>
  )
}