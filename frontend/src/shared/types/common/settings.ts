export const SETTINGS_QUERY_KEY = 'settings'

export const SETTINGS_SECTIONS = ['account', 'appearance', 'notifications'] as const
export const ADMIN_SETTINGS_SECTIONS = ['platformWorkflowTemplates'] as const

export type BaseSettingsSection = (typeof SETTINGS_SECTIONS)[number]
export type AdminSettingsSection = (typeof ADMIN_SETTINGS_SECTIONS)[number]
export type SettingsSection = BaseSettingsSection | AdminSettingsSection

export const SETTINGS_SECTION_LABELS: Record<SettingsSection, string> = {
  account: '账号',
  appearance: '通用',
  notifications: '通知',
  platformWorkflowTemplates: '平台工作流',
}

export const isSettingsSection = (value: string): value is SettingsSection => {
  return (
    SETTINGS_SECTIONS.includes(value as BaseSettingsSection) ||
    ADMIN_SETTINGS_SECTIONS.includes(value as AdminSettingsSection)
  )
}

export const getAvailableSettingsSections = (options?: { isPlatformAdmin?: boolean }) => {
  return [
    ...SETTINGS_SECTIONS,
    ...(options?.isPlatformAdmin ? ADMIN_SETTINGS_SECTIONS : []),
  ]
}

export const resolveAuthorizedSettingsSection = (
  candidate: string,
  options?: { isPlatformAdmin?: boolean },
): SettingsSection => {
  const legacyAccountSections = new Set(['profile', 'security'])

  if (legacyAccountSections.has(candidate)) {
    return 'account'
  }

  if (getAvailableSettingsSections(options).includes(candidate as SettingsSection)) {
    return candidate as SettingsSection
  }

  return getAvailableSettingsSections(options)[0] ?? 'account'
}
