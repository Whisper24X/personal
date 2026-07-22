import type { ProjectMenuId } from '@shared/constants/access-control'
import { STORAGE_KEYS } from '@shared/types/common/storage'

export type ProjectItem = {
  id: string
  name: string
  slug?: string
  to: string
  businessLineId: string
  description?: string | null
  gitUrl: string
  defaultBranch: string
  repositoryProvisioningStatus?: 'pending' | 'ready' | 'failed'
  repositoryProvisioningError?: string | null
  repositoryProvisionedAt?: string | null
  configJson?: Record<string, unknown> | null
}

export type BusinessLineItem = {
  id: string
  name: string
  owner: string
  projectCount: number
  description?: string | null
}

export type MenuItem = {
  id: ProjectMenuId
  label: string
  to: string
  capabilities?: readonly string[]
}

export type BusinessLine = {
  id: string
  name: string
  description?: string | null
  owner: string
  projects: ProjectItem[]
}

export const normalizeQueryValue = (queryValue: unknown) => {
  if (typeof queryValue === 'string') return queryValue
  if (Array.isArray(queryValue)) return queryValue[0] ?? ''
  return ''
}

export const loadStoredSelectedProjectId = () => {
  return localStorage.getItem(STORAGE_KEYS.lastSelectedProjectId) ?? ''
}

export const loadStoredSelectedMenuPath = () => {
  return localStorage.getItem(STORAGE_KEYS.lastSelectedMenuPath) ?? ''
}

export const loadStoredActiveBusinessLineId = () => {
  return localStorage.getItem(STORAGE_KEYS.lastActiveBusinessLineId)?.trim() ?? ''
}

export const persistActiveBusinessLineId = (businessLineId: string) => {
  if (businessLineId.trim()) {
    localStorage.setItem(STORAGE_KEYS.lastActiveBusinessLineId, businessLineId.trim())
  } else {
    localStorage.removeItem(STORAGE_KEYS.lastActiveBusinessLineId)
  }
}
