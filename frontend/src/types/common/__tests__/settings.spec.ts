import { describe, expect, it } from 'vitest'
import {
  SETTINGS_SECTION_LABELS,
  getAvailableSettingsSections,
  resolveAuthorizedSettingsSection,
} from '@/types/common/settings'

describe('settings section authorization', () => {
  it('provides merged settings sections', () => {
    expect(getAvailableSettingsSections()).toEqual(['account', 'appearance', 'notifications'])
  })

  it('maps legacy account sections and falls back correctly', () => {
    expect(resolveAuthorizedSettingsSection('profile')).toBe('account')
    expect(resolveAuthorizedSettingsSection('security')).toBe('account')
    expect(resolveAuthorizedSettingsSection('users')).toBe('account')
  })

  it('uses updated labels', () => {
    expect(SETTINGS_SECTION_LABELS.account).toBe('账号')
    expect(SETTINGS_SECTION_LABELS.appearance).toBe('通用')
    expect(SETTINGS_SECTION_LABELS.notifications).toBe('通知')
  })
})
