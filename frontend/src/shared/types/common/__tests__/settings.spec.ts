import { describe, expect, it } from 'vitest'
import {
  SETTINGS_SECTION_LABELS,
  getAvailableSettingsSections,
  resolveAuthorizedSettingsSection,
} from '@shared/types/common/settings'

describe('settings section authorization', () => {
  it('provides merged settings sections', () => {
    expect(getAvailableSettingsSections()).toEqual(['account', 'appearance', 'notifications'])
    expect(getAvailableSettingsSections({ isPlatformAdmin: true })).toEqual([
      'account',
      'appearance',
      'notifications',
      'platformWorkflowTemplates',
    ])
  })

  it('maps legacy account sections and falls back correctly', () => {
    expect(resolveAuthorizedSettingsSection('profile')).toBe('account')
    expect(resolveAuthorizedSettingsSection('security')).toBe('account')
    expect(resolveAuthorizedSettingsSection('users')).toBe('account')
    expect(resolveAuthorizedSettingsSection('platformWorkflowTemplates')).toBe('account')
    expect(
      resolveAuthorizedSettingsSection('platformWorkflowTemplates', {
        isPlatformAdmin: true,
      }),
    ).toBe('platformWorkflowTemplates')
  })

  it('uses updated labels', () => {
    expect(SETTINGS_SECTION_LABELS.account).toBe('账号')
    expect(SETTINGS_SECTION_LABELS.appearance).toBe('通用')
    expect(SETTINGS_SECTION_LABELS.notifications).toBe('通知')
    expect(SETTINGS_SECTION_LABELS.platformWorkflowTemplates).toBe('平台工作流')
  })
})
