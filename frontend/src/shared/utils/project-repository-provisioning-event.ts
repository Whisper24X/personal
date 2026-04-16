export type ProjectRepositoryProvisioningChangedStatus = 'ready' | 'failed'

export type ProjectRepositoryProvisioningChangedDetail = {
  projectId: string
  businessLineId: string
  status: ProjectRepositoryProvisioningChangedStatus
  errorMessage?: string | null
}

export const PROJECT_REPOSITORY_PROVISIONING_CHANGED_EVENT =
  'project-repository-provisioning-changed'

export const emitProjectRepositoryProvisioningChangedEvent = (
  detail: ProjectRepositoryProvisioningChangedDetail,
) => {
  window.dispatchEvent(
    new CustomEvent<ProjectRepositoryProvisioningChangedDetail>(
      PROJECT_REPOSITORY_PROVISIONING_CHANGED_EVENT,
      { detail },
    ),
  )
}

export const addProjectRepositoryProvisioningChangedListener = (
  listener: (detail: ProjectRepositoryProvisioningChangedDetail) => void,
) => {
  const handler: EventListener = (event) => {
    const customEvent = event as CustomEvent<ProjectRepositoryProvisioningChangedDetail>
    if (!customEvent.detail) {
      return
    }
    listener(customEvent.detail)
  }

  window.addEventListener(PROJECT_REPOSITORY_PROVISIONING_CHANGED_EVENT, handler)

  return () => {
    window.removeEventListener(PROJECT_REPOSITORY_PROVISIONING_CHANGED_EVENT, handler)
  }
}
