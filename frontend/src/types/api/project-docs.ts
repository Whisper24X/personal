export type ProjectDocItem = {
  path: string
  name: string
  size: number
  updatedAt: string
}

export type ProjectDocContent = ProjectDocItem & {
  content: string
}

export type SaveProjectDocPayload = {
  path: string
  /** Text content for text files (e.g. .md, .txt) */
  content?: string
  /** Base64-encoded content for binary files (e.g. images). When set, content is ignored. */
  contentBase64?: string
}

export type ProjectDocsEntry = {
  name: string
  path: string
  isDir: boolean
}

export type ProjectDocsTree = {
  cwd: string
  entries: ProjectDocsEntry[]
}

export type ProjectDocsPreview = {
  path: string
  previewType: 'text' | 'image' | 'binary' | 'pdf' | 'video' | 'audio'
  tooLarge: boolean
  size: number
  mimeType?: string | null
  text?: string | null
  dataUrl?: string | null
}

export type ProjectDocQueryScope = 'project' | 'current_doc'

export type QueryProjectDocsPayload = {
  question: string
  scope?: ProjectDocQueryScope
  currentPath?: string
  maxContextDocs?: number
}

export type ProjectDocCitation = {
  path: string
  snippet: string
}

export type QueryProjectDocsResponse = {
  answer: string
  citations: ProjectDocCitation[]
  durationMs: number
  traceId?: string
}
