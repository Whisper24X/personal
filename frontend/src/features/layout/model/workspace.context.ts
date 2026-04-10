import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { BusinessLineItem, ProjectItem } from '@features/layout/composables/useLayout'

export type LayoutWorkspaceContext = {
  hasAnyBusinessLine: ComputedRef<boolean>
  layoutDataLoading: Ref<boolean>
  canCreateBusinessLine: ComputedRef<boolean>
  openBusinessLineModal: () => void
  businessLineItems: ComputedRef<BusinessLineItem[]>
  activeBusinessLineId: Ref<string>
  selectedProjectId: Ref<string>
  selectBusinessLine: (businessLineId: string) => Promise<void>
  selectProject: (projectId: string) => Promise<void>
  refreshLayoutData: () => Promise<void>
  projectItems: ComputedRef<ProjectItem[]>
}

export const layoutWorkspaceKey: InjectionKey<LayoutWorkspaceContext> = Symbol('layoutWorkspace')
