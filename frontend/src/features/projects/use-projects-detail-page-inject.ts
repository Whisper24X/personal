import { inject } from 'vue'
import {
  projectsDetailPageInjectionKey,
  type ProjectsDetailPageContext,
} from './use-projects-detail-page'

export function useProjectsDetailPageInject(): ProjectsDetailPageContext {
  const ctx = inject(projectsDetailPageInjectionKey)
  if (!ctx) {
    throw new Error('useProjectsDetailPageInject must be used under ProjectsDetailPage')
  }
  return ctx
}
