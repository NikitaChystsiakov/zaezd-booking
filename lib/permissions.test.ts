import { describe, expect, it } from 'vitest'
import { can, ROLE_PERMISSIONS, ROLE_RANK, ROLES, type Permission } from './permissions'

describe('права ролей', () => {
  it('каждая роль включает всё, что есть у роли ниже', () => {
    const byRank = [...ROLES].sort((a, b) => ROLE_RANK[a] - ROLE_RANK[b])
    for (let i = 1; i < byRank.length; i++) {
      for (const p of ROLE_PERMISSIONS[byRank[i - 1]]) expect(can(byRank[i], p)).toBe(true)
    }
  })

  it('администратор (staff) работает с заявками и календарём, но не меняет дома и настройки', () => {
    expect(['leads:read', 'leads:write', 'calendar:write', 'units:read'].every((p) => can('staff', p as Permission))).toBe(true)
    expect(['units:write', 'units:delete', 'settings:write', 'team:manage'].some((p) => can('staff', p as Permission))).toBe(false)
  })

  it('управляющий (admin) правит дома, но не удаляет их и не трогает настройки и команду', () => {
    expect(can('admin', 'units:write')).toBe(true)
    expect(['units:delete', 'settings:write', 'team:manage'].some((p) => can('admin', p as Permission))).toBe(false)
  })

  it('деньги и команда — только у владельца', () => {
    for (const p of ['settings:write', 'team:manage', 'units:delete'] as const) {
      expect(ROLES.filter((r) => can(r, p))).toEqual(['owner'])
    }
  })
})
