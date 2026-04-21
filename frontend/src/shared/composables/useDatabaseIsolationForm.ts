import { reactive, ref } from 'vue'
import { useMessage } from '@app/composables/useMessage'
import { projectsApi } from '@/api/projects'
import { toErrorMessage } from '@api/shared/to-error-message'
import type {
  DatabaseIsolationConfig,
  DatabaseIsolationTableInfo,
} from '@/types/api/projects'

export type DatabaseIsolationFormState = {
  dbIsolationEnabled: boolean
  dbIsolationHost: string
  dbIsolationPort: string
  dbIsolationAdminUser: string
  dbIsolationAdminPassword: string
  dbIsolationSourceDatabase: string
  dbIsolationEnvVar: string
  dbIsolationSelectedTables: string[]
}

export const createDatabaseIsolationFormState = (): DatabaseIsolationFormState => ({
  dbIsolationEnabled: false,
  dbIsolationHost: '',
  dbIsolationPort: '5432',
  dbIsolationAdminUser: 'postgres',
  dbIsolationAdminPassword: '',
  dbIsolationSourceDatabase: '',
  dbIsolationEnvVar: '',
  dbIsolationSelectedTables: [],
})

export const useDatabaseIsolationForm = (form: DatabaseIsolationFormState) => {
  const message = useMessage()
  const scannedTables = ref<DatabaseIsolationTableInfo[]>([])
  const scanningTables = ref(false)

  const syncFromConfigJson = (configJson: Record<string, unknown>) => {
    const raw = configJson.databaseIsolation
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      Object.assign(form, createDatabaseIsolationFormState())
      return
    }

    const config = raw as DatabaseIsolationConfig
    form.dbIsolationEnabled = config.enabled === true
    form.dbIsolationHost = config.postgres?.host ?? ''
    form.dbIsolationPort = String(config.postgres?.port ?? 5432)
    form.dbIsolationAdminUser = config.postgres?.adminUser ?? 'postgres'
    form.dbIsolationSourceDatabase = config.postgres?.sourceDatabase ?? ''
    form.dbIsolationEnvVar = config.envVar ?? ''
    form.dbIsolationSelectedTables = config.dataImport?.tables ?? []

    const savedPassword = configJson.dbIsolationAdminPassword
    form.dbIsolationAdminPassword =
      typeof savedPassword === 'string' ? savedPassword : ''
  }

  const buildConfigJson = (
    currentConfigJson: Record<string, unknown>,
  ): Record<string, unknown> => {
    const next = { ...currentConfigJson }

    if (!form.dbIsolationEnabled) {
      delete next.databaseIsolation
      delete next.dbIsolationAdminPassword
      return next
    }

    const config: DatabaseIsolationConfig = {
      enabled: true,
      postgres: {
        host: form.dbIsolationHost.trim(),
        port: Number(form.dbIsolationPort) || 5432,
        adminUser: form.dbIsolationAdminUser.trim() || 'postgres',
        sourceDatabase: form.dbIsolationSourceDatabase.trim(),
      },
      envVar: form.dbIsolationEnvVar.trim(),
    }

    if (form.dbIsolationSelectedTables.length > 0) {
      config.dataImport = { tables: [...form.dbIsolationSelectedTables] }
    }

    next.databaseIsolation = config
    next.dbIsolationAdminPassword = form.dbIsolationAdminPassword
    return next
  }

  const validate = (): string => {
    if (!form.dbIsolationEnabled) {
      return ''
    }

    if (!form.dbIsolationHost.trim()) {
      return '数据库隔离：请填写数据库地址'
    }
    if (!form.dbIsolationSourceDatabase.trim()) {
      return '数据库隔离：请填写基准数据库名'
    }
    if (!form.dbIsolationEnvVar.trim()) {
      return '数据库隔离：请填写环境变量名'
    }
    if (!form.dbIsolationAdminPassword) {
      return '数据库隔离：请填写管理员密码'
    }

    return ''
  }

  const scanTables = async (projectId: string) => {
    if (!form.dbIsolationAdminPassword) {
      message.error('请先填写管理员密码')
      return
    }
    if (!form.dbIsolationHost.trim()) {
      message.error('请先填写数据库地址')
      return
    }
    if (!form.dbIsolationSourceDatabase.trim()) {
      message.error('请先填写基准数据库名')
      return
    }

    scanningTables.value = true
    try {
      scannedTables.value = await projectsApi.scanDatabaseTables(projectId, {
        adminPassword: form.dbIsolationAdminPassword,
        host: form.dbIsolationHost.trim(),
        port: Number(form.dbIsolationPort) || 5432,
        adminUser: form.dbIsolationAdminUser.trim() || 'postgres',
        sourceDatabase: form.dbIsolationSourceDatabase.trim(),
      })
      message.success(`扫描完成，共 ${scannedTables.value.length} 张表`)
    } catch (error) {
      message.error(toErrorMessage(error, '扫描表失败，请检查数据库连接配置'))
    } finally {
      scanningTables.value = false
    }
  }

  const toggleTable = (tableName: string) => {
    const idx = form.dbIsolationSelectedTables.indexOf(tableName)
    if (idx >= 0) {
      form.dbIsolationSelectedTables.splice(idx, 1)
    } else {
      form.dbIsolationSelectedTables.push(tableName)
    }
  }

  const selectAllTables = () => {
    form.dbIsolationSelectedTables = scannedTables.value.map((t) => t.name)
  }

  const clearAllTables = () => {
    form.dbIsolationSelectedTables = []
  }

  const selectSmallTables = (maxRows = 1000) => {
    form.dbIsolationSelectedTables = scannedTables.value
      .filter((t) => t.estimatedRows <= maxRows)
      .map((t) => t.name)
  }

  const formatSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }
    if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`
    }
    return `${bytes} B`
  }

  const formatRows = (rows: number): string => {
    if (rows >= 10000) {
      return `${(rows / 1000).toFixed(0)}k`
    }
    return String(rows)
  }

  return {
    scannedTables,
    scanningTables,
    syncFromConfigJson,
    buildConfigJson,
    validate,
    scanTables,
    toggleTable,
    selectAllTables,
    clearAllTables,
    selectSmallTables,
    formatSize,
    formatRows,
  }
}
