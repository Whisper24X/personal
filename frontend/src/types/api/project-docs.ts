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
  content: string
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
