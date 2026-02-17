export type ProjectContextDocument = {
  path: string
  title: string
  preview: string
  length: number
}

export type ProjectContext = {
  projectId: string
  gitUrl: string
  defaultBranch: string
  source: 'local_repository' | 'project_config' | 'empty'
  generatedAt: string
  documents: ProjectContextDocument[]
  warnings: string[]
}
