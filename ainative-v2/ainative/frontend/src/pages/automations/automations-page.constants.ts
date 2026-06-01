export const AUTOMATION_PAGE_LIMIT = 20

export type AutomationScheduleMode = 'daily' | 'interval'
export type AutomationWeekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU'

export const AUTOMATION_WEEKDAY_OPTIONS: Array<{ label: string; value: AutomationWeekday }> = [
  { label: '一', value: 'MO' },
  { label: '二', value: 'TU' },
  { label: '三', value: 'WE' },
  { label: '四', value: 'TH' },
  { label: '五', value: 'FR' },
  { label: '六', value: 'SA' },
  { label: '日', value: 'SU' },
]

export const DEFAULT_AUTOMATION_WEEKDAYS: AutomationWeekday[] = ['MO', 'TU', 'WE', 'TH', 'FR']
export const DEFAULT_AUTOMATION_TIME = '09:00'
export const AUTOMATION_STATUS_FILTER_OPTIONS = [
  { label: '全部状态', value: 'all' },
  { label: '运行中', value: 'active' },
  { label: '已暂停', value: 'paused' },
] as const
