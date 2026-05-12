import type { TaskMessage } from '@/types/api/tasks'

export type OpenArtifactFilePayload = {
  path: string
  taskNodeId?: string | null
}

const RUNNER_WORKSPACE_PREFIX = '/workspace/'
const WORKTREE_PATH_MARKER = '/worktrees/'
const RELATIVE_ARTIFACT_PREFIXES = ['docs/']

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function cleanWorkspaceRelativePath(value: string): string | null {
  const decoded = safeDecodeURIComponent(value).replace(/\\/g, '/')
  const withoutQuery = decoded.split(/[?#]/, 1)[0]?.trim() ?? ''
  const normalized = withoutQuery.replace(/^\/+/, '')
  if (!normalized) return null

  const parts = normalized.split('/').filter(Boolean)
  if (parts.some((part) => part === '.' || part === '..')) return null

  return parts.join('/')
}

function stripUrlToPath(value: string): string | null {
  const schemeMatch = /^[a-z][a-z\d+.-]*:/i.exec(value)
  if (!schemeMatch) return value

  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return null
  }
}

export function normalizeAgentWorkspaceFileHref(rawHref?: string | null): string | null {
  const trimmed = rawHref?.trim()
  if (!trimmed || trimmed.startsWith('#')) return null

  const pathLikeValue = stripUrlToPath(trimmed)
  if (!pathLikeValue) return null

  const normalizedValue = safeDecodeURIComponent(pathLikeValue).replace(/\\/g, '/')
  const workspaceIndex = normalizedValue.indexOf(RUNNER_WORKSPACE_PREFIX)
  if (workspaceIndex >= 0) {
    return cleanWorkspaceRelativePath(
      normalizedValue.slice(workspaceIndex + RUNNER_WORKSPACE_PREFIX.length),
    )
  }

  const worktreeIndex = normalizedValue.indexOf(WORKTREE_PATH_MARKER)
  if (worktreeIndex >= 0) {
    const afterMarker = normalizedValue.slice(worktreeIndex + WORKTREE_PATH_MARKER.length)
    const firstSlashIndex = afterMarker.indexOf('/')
    if (firstSlashIndex >= 0) {
      return cleanWorkspaceRelativePath(afterMarker.slice(firstSlashIndex + 1))
    }
  }

  const relativeCandidate = normalizedValue.replace(/^\.\//, '')
  if (RELATIVE_ARTIFACT_PREFIXES.some((prefix) => relativeCandidate.startsWith(prefix))) {
    return cleanWorkspaceRelativePath(relativeCandidate)
  }

  return null
}

export function resolveTaskNodeIdForArtifactLink(
  messages: TaskMessage[],
  artifactPath: string,
): string | null {
  const encodedPath = encodeURI(artifactPath)
  const candidates = [
    artifactPath,
    encodedPath,
    `${RUNNER_WORKSPACE_PREFIX}${artifactPath}`,
    `${RUNNER_WORKSPACE_PREFIX}${encodedPath}`,
  ]

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (!message) continue

    const taskNodeId = message.taskNodeId?.trim()
    if (!taskNodeId) continue

    if (candidates.some((candidate) => message.content.includes(candidate))) {
      return taskNodeId
    }
  }

  return null
}
