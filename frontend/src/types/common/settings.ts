export const SETTINGS_QUERY_KEY = 'settings'

export const SETTINGS_SECTIONS = ['account', 'appearance', 'notifications'] as const

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

export const SETTINGS_SECTION_LABELS: Record<SettingsSection, string> = {
  account: '账号',
  appearance: '通用',
  notifications: '通知',
}

export const isSettingsSection = (value: string): value is SettingsSection => {
  return SETTINGS_SECTIONS.includes(value as SettingsSection)
}

export const getAvailableSettingsSections = (_isAdmin: boolean) => {
  return [...SETTINGS_SECTIONS]
}

export const resolveAuthorizedSettingsSection = (candidate: string, isAdmin: boolean): SettingsSection => {
  void isAdmin
  const legacyAccountSections = new Set(['profile', 'security'])

  if (legacyAccountSections.has(candidate)) {
    return 'account'
  }

  if (isSettingsSection(candidate)) {
    return candidate
  }

  return getAvailableSettingsSections(isAdmin)[0] ?? 'account'
}
