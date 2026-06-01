import type { ProjectItem } from '@features/layout'
import type { Project, ProjectContainerRuntimeConfig } from '@/types/api/projects'

export function formatBlmDate(value?: string) {
  if (!value) {
    return '-'
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return parsedDate.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function toProjectConfigJsonRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function toProjectContainerRuntimeConfig(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as ProjectContainerRuntimeConfig)
    : null
}

export function summarizeProjectRuntimeConfig(project: ProjectItem) {
  const containerRuntime = toProjectContainerRuntimeConfig(
    project.configJson?.containerRuntime,
  )

  const summary: string[] = []

  const envCount =
    containerRuntime?.env && typeof containerRuntime.env === 'object'
      ? Object.keys(containerRuntime.env).length
      : 0
  if (envCount > 0) {
    summary.push(`环境变量: ${envCount}`)
  }
  if (Array.isArray(containerRuntime?.runnerOrchestration?.services)) {
    summary.push(`服务: ${containerRuntime.runnerOrchestration.services.length}`)
  }
  if (containerRuntime?.runnerOrchestration?.preview?.service) {
    summary.push(
      `预览: ${containerRuntime.runnerOrchestration.preview.path || '/'} -> ${containerRuntime.runnerOrchestration.preview.service}`,
    )
  }

  return summary.length > 0 ? summary.join(' · ') : '当前使用默认容器配置'
}

export function mapProjectItem(project: Project): ProjectItem {
  return {
    id: project.id,
    name: project.name,
    to: `/dashboard?projectId=${encodeURIComponent(project.id)}`,
    businessLineId: project.businessLineId,
    description: project.description ?? null,
    gitUrl: project.gitUrl,
    defaultBranch: project.defaultBranch,
    repositoryProvisioningStatus: project.repositoryProvisioningStatus ?? 'ready',
    repositoryProvisioningError: project.repositoryProvisioningError ?? null,
    repositoryProvisionedAt: project.repositoryProvisionedAt ?? null,
    configJson: project.configJson ?? null,
  }
}
