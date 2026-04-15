export type FileBrowserEntry = {
  name: string
  path: string
  isDir: boolean
}

export type FileBrowserTree = {
  cwd: string
  entries: FileBrowserEntry[]
}

export type FileBrowserPreview = {
  path: string
  previewType: 'text' | 'image' | 'binary' | 'markdown' | 'pdf' | 'video' | 'audio'
  tooLarge: boolean
  size: number
  mimeType?: string | null
  text?: string | null
  dataUrl?: string | null
}

export type FileBrowserLoadTree = (path: string) => Promise<FileBrowserTree>
export type FileBrowserLoadPreview = (path: string) => Promise<FileBrowserPreview>
