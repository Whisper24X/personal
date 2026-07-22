const GIT_REF_SEGMENT_MAX_LENGTH = 80
const GIT_PROJECT_BRANCH_MAX_LENGTH = 255

const RESERVED_REF_NAMES = new Set([
  'HEAD',
  'FETCH_HEAD',
  'ORIG_HEAD',
  'MERGE_HEAD',
  'CHERRY_PICK_HEAD',
])

export function validateGitRefSlugSegment(value: string, label: string): string | null {
  const normalized = value.trim()
  if (!normalized) {
    return `${label}不能为空`
  }
  return assertSafeGitRefSegment(normalized, label) ?? null
}

export function buildProjectWorkspaceBranch(
  businessLineSlug: string,
  projectSlug: string,
): { branch: string; error: string | null } {
  const blError = validateGitRefSlugSegment(businessLineSlug, '业务线标识')
  if (blError) {
    return { branch: '', error: blError }
  }
  const projectError = validateGitRefSlugSegment(projectSlug, '项目标识')
  if (projectError) {
    return { branch: '', error: projectError }
  }
  const bl = businessLineSlug.trim()
  const project = projectSlug.trim()
  const branch = `${bl}-${project}`
  if (branch.length > GIT_PROJECT_BRANCH_MAX_LENGTH) {
    return { branch: '', error: '项目 workspace 分支名过长' }
  }
  const branchError = assertSafeGitRefSegment(branch, '项目 workspace 分支')
  if (branchError) {
    return { branch: '', error: branchError }
  }
  return { branch, error: null }
}

function assertSafeGitRefSegment(value: string, label: string): string | null {
  if (value.length > GIT_REF_SEGMENT_MAX_LENGTH) {
    return `${label}过长`
  }
  if (value.includes('..') || value.includes('/')) {
    return `${label}包含非法序列`
  }
  const whitespaceOrControlError = hasWhitespaceOrControlChar(value, label)
  if (whitespaceOrControlError) {
    return whitespaceOrControlError
  }
  if (value.startsWith('-')) {
    return `${label}不能以 - 开头`
  }
  if (value.endsWith('.') || value.endsWith('/')) {
    return `${label}不能以 . 或 / 结尾`
  }
  if (value.includes('\\') || value.includes('~') || value.includes('^')) {
    return `${label}包含非法字符`
  }
  if (RESERVED_REF_NAMES.has(value)) {
    return `${label}不能使用保留名`
  }
  return null
}

function hasWhitespaceOrControlChar(value: string, label: string): string | null {
  for (const char of value) {
    const code = char.charCodeAt(0)
    if (code <= 32 || code === 127) {
      return `${label}不能包含空白或控制字符`
    }
  }
  return null
}
