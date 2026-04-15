import { projectsApi } from '@/api/projects'

const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'json',
  'yml',
  'yaml',
  'xml',
  'csv',
  'ts',
  'tsx',
  'js',
  'jsx',
  'vue',
  'css',
  'scss',
  'sass',
  'less',
  'html',
  'htm',
  'sql',
  'sh',
  'bash',
  'zsh',
  'py',
  'java',
  'go',
  'rs',
  'c',
  'cc',
  'cpp',
  'h',
  'hpp',
])

/** 与知识库页面 isBinaryFile 逻辑一致 */
export function isBinaryFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const mimeType = (file.type || '').toLowerCase()
  if (!mimeType) {
    return !TEXT_EXTENSIONS.has(ext)
  }

  if (mimeType.startsWith('text/')) {
    return false
  }
  if (
    mimeType === 'application/json' ||
    mimeType === 'application/xml' ||
    mimeType === 'application/x-yaml'
  ) {
    return false
  }

  return true
}

export function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

/** 用于 docs 相对路径中的文件名片段，避免路径穿越与非法字符 */
export function sanitizeGoalInputBasename(name: string): string {
  const trimmed = name.trim() || 'file'
  return trimmed.replace(/[/\\?]/g, '_').replace(/\.\./g, '_').slice(0, 180)
}

/**
 * 将文件写入项目 docs（与知识库 upload 一致：先 create，冲突则 update）。
 */
export async function createOrUpdateProjectDoc(
  projectId: string,
  relativePath: string,
  file: File,
): Promise<void> {
  if (isBinaryFile(file)) {
    const formData = new FormData()
    formData.append('path', relativePath)
    formData.append('file', file)
    await projectsApi.uploadDoc(projectId, formData)
    return
  }
  const content = await file.text()
  const payload = { path: relativePath, content }
  try {
    await projectsApi.createDoc(projectId, payload)
  } catch {
    await projectsApi.updateDoc(projectId, payload)
  }
}
