// Роли и права доступа. Подробности и обоснование — docs/ROLES.md.
// Файл без обращений к базе и Next: им пользуются и сервер, и интерфейс, и юнит-тесты.

import type { Role } from '@prisma/client'

export type Permission =
  | 'leads:read'
  | 'leads:write'
  | 'calendar:write'
  | 'units:read'
  | 'units:write'
  | 'units:delete'
  | 'settings:write'
  | 'team:manage'

const STAFF: Permission[] = ['leads:read', 'leads:write', 'calendar:write', 'units:read']
const ADMIN: Permission[] = [...STAFF, 'units:write']
const OWNER: Permission[] = [...ADMIN, 'units:delete', 'settings:write', 'team:manage']

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = { owner: OWNER, admin: ADMIN, staff: STAFF }

/** Чем больше число, тем выше роль. Нужно, чтобы нельзя было выдать роль выше своей. */
export const ROLE_RANK: Record<Role, number> = { staff: 1, admin: 2, owner: 3 }

export const ROLE_LABEL: Record<Role, string> = { owner: 'Владелец', admin: 'Управляющий', staff: 'Администратор' }

export const ROLE_HINT: Record<Role, string> = {
  owner: 'Всё, включая настройки, реквизиты и команду',
  admin: 'Дома, тарифы, услуги, заявки и календарь',
  staff: 'Заявки и календарь; остальное — только просмотр',
}

export const ROLES: readonly Role[] = ['owner', 'admin', 'staff']

export const can = (role: Role, permission: Permission): boolean => ROLE_PERMISSIONS[role].includes(permission)
