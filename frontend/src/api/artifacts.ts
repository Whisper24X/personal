import type {
  ArtifactDownloadResponse,
  ArtifactPreview,
} from '@/types/api/artifacts'
import type { TaskArtifact } from '@/types/api/tasks'
import { apiHttp } from './http'

export type { ArtifactDownloadResponse }

export const artifactsApi = {
  detail(artifactId: string) {
    return apiHttp.get<TaskArtifact>(`/artifacts/${artifactId}`)
  },

  download(artifactId: string, worktreePath?: string) {
    return apiHttp.get<ArtifactDownloadResponse>(
      `/artifacts/${artifactId}/download`,
      { worktreePath },
    )
  },

  preview(artifactId: string, worktreePath?: string) {
    return apiHttp.get<ArtifactPreview>(`/artifacts/${artifactId}/preview`, {
      worktreePath,
    })
  },
}
