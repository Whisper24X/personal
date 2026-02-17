import type { TaskArtifactType } from './tasks'

export type ArtifactPreviewMode = 'diff' | 'text' | 'external'

export type ArtifactPreviewFileTreeNode = {
  name: string
  path: string
  type: 'file' | 'directory'
  children: ArtifactPreviewFileTreeNode[]
}

export type ArtifactPreview = {
  artifactId: string
  mode: ArtifactPreviewMode
  artifactType: TaskArtifactType
  title: string
  patch?: string | null
  text?: string | null
  changedFiles: string[]
  fileTree: ArtifactPreviewFileTreeNode[]
  truncated: boolean
  downloadUrl?: string | null
}
