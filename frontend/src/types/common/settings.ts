export const SETTINGS_QUERY_KEY = 'settings'

export const SETTINGS_SECTIONS = ['profile', 'about', 'business-lines', 'projects', 'users'] as const

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

export const SETTINGS_SECTION_LABELS: Record<SettingsSection, string> = {
  profile: '个人设置',
  about: '关于',
  'business-lines': '业务线管理',
  projects: '项目管理',
  users: '用户管理',
}

export const isSettingsSection = (value: string): value is SettingsSection => {
  return SETTINGS_SECTIONS.includes(value as SettingsSection)
}

export const sectionRequiresAdmin = (section: SettingsSection) => section === 'users'

export const getAvailableSettingsSections = (isAdmin: boolean) => {
  return SETTINGS_SECTIONS.filter((section) => {
    if (!sectionRequiresAdmin(section)) {
      return true
    }

    return isAdmin
  })
}

export const resolveAuthorizedSettingsSection = (candidate: string, isAdmin: boolean): SettingsSection => {
  if (isSettingsSection(candidate)) {
    if (!sectionRequiresAdmin(candidate) || isAdmin) {
      return candidate
    }
  }

  return getAvailableSettingsSections(isAdmin)[0] ?? 'profile'
}
