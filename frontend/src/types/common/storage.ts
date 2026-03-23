export const STORAGE_KEYS = {
  authToken: 'ainative-auth-token',
  refreshToken: 'ainative-refresh-token',
  locale: 'ainative-locale',
  theme: 'ainative-theme',
  themeColor: 'ainative-theme-color',
  backgroundStyle: 'ainative-background-style',
  lastSelectedProjectId: 'ainative-last-selected-project-id',
  lastSelectedMenuPath: 'ainative-last-selected-menu-path',
  taskDetailRightPanelVisible: 'ainative-task-detail-right-panel-visible',
  /** 步骤条 AI 摘要缓存 key 前缀（完整 key 为 `${prefix}:${encodeURIComponent(taskId)}:${hash}`） */
  stepSummariesCachePrefix: 'ainative.stepSummaries.v1',
  taskDetailTerminalSessionId: 'ainative-task-detail-terminal-session-id',
} as const
