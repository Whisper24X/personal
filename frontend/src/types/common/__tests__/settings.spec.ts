import { describe, expect, it } from 'vitest'
import {
  SETTINGS_SECTION_LABELS,
  getAvailableSettingsSections,
  resolveAuthorizedSettingsSection,
} from '@/types/common/settings'

describe('settings section authorization', () => {
  it('hides users section for non-admin users', () => {
    expect(getAvailableSettingsSections(false)).not.toContain('users')
    expect(getAvailableSettingsSections(true)).toContain('users')
  })

  it('falls back to an authorized section when section is forbidden', () => {
    expect(resolveAuthorizedSettingsSection('users', false)).toBe('profile')
    expect(resolveAuthorizedSettingsSection('users', true)).toBe('users')
  })

  it('uses updated label for business lines section', () => {
    expect(SETTINGS_SECTION_LABELS['business-lines']).toBe('业务线')
  })
})
