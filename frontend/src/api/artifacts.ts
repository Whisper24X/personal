import type { ArtifactPreview } from '@/types/api/artifacts'
import type { TaskArtifact } from '@/types/api/tasks'
import { apiHttp } from './http'

export type ArtifactDownloadResponse = {
  artifactId: string
  downloadUrl?: string | null
  content?: string | null
}

export const artifactsApi = {
  detail(artifactId: string) {
    return apiHttp.get<TaskArtifact>(`/artifacts/${artifactId}`)
  },

  download(artifactId: string) {
    return apiHttp.get<ArtifactDownloadResponse>(`/artifacts/${artifactId}/download`)
  },

  preview(artifactId: string) {
    return apiHttp.get<ArtifactPreview>(`/artifacts/${artifactId}/preview`)
  },
}
