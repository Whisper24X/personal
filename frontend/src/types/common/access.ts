export type BusinessLineRole = 'owner' | 'admin' | 'member'

export type ProjectRole = 'owner' | 'maintainer' | 'developer' | 'viewer'

export type AccessContextParams = Partial<{
  businessLineId: string
  projectId: string
}>

export type CurrentAccessResponse = {
  user: {
    id: string
    username: string
    nickname?: string | null
    avatar?: string | null
  }
  currentContext: {
    businessLineId?: string
    projectId?: string
    businessRole?: BusinessLineRole | null
    projectRole?: ProjectRole | null
  }
  capabilities: string[]
  visibility: {
    visibleBusinessLineIds: string[]
    visibleProjectIds: string[]
  }
}
