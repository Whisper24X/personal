import { apiHttp, type InfinityPaginationResponse } from './http'

export type BusinessLine = {
  id: string
  name: string
  description?: string | null
  createdAt?: string
  updatedAt?: string
}

export type BusinessLineMemberRole = 'owner' | 'admin' | 'member'

export type BusinessLineMember = {
  id: string
  businessLineId: string
  userId: string
  role: BusinessLineMemberRole
  createdAt?: string
  updatedAt?: string
}

export type CreateBusinessLinePayload = {
  name: string
  description?: string
}

export type UpdateBusinessLinePayload = Partial<CreateBusinessLinePayload>

export type CreateBusinessLineMemberPayload = {
  userId: string
  role: BusinessLineMemberRole
}

export type UpdateBusinessLineMemberPayload = {
  role: BusinessLineMemberRole
}

export type BusinessLineInviteProjectRole = 'none' | 'manage' | 'developer' | 'viewer'

export type CreateBusinessLineInvitePayload = {
  role: BusinessLineMemberRole
  projectRoles?: Record<string, BusinessLineInviteProjectRole>
}

export type BusinessLineInvite = {
  token: string
  expiresAt: string
  businessLineId: string
  role: BusinessLineMemberRole
  projectRoles: Record<string, BusinessLineInviteProjectRole>
}

export type AcceptBusinessLineInvitePayload = {
  token: string
}

export type AcceptBusinessLineInviteResponse = {
  member: BusinessLineMember
  failedProjects: string[]
}

export const businessLinesApi = {
  list(params?: { page?: number; limit?: number }) {
    return apiHttp.get<InfinityPaginationResponse<BusinessLine>>('/business-lines', {
      page: params?.page,
      limit: params?.limit,
    })
  },

  detail(businessLineId: string) {
    return apiHttp.get<BusinessLine>(`/business-lines/${businessLineId}`)
  },

  create(payload: CreateBusinessLinePayload) {
    return apiHttp.post<BusinessLine>('/business-lines', payload)
  },

  update(businessLineId: string, payload: UpdateBusinessLinePayload) {
    return apiHttp.patch<BusinessLine>(`/business-lines/${businessLineId}`, payload)
  },

  remove(businessLineId: string) {
    return apiHttp.delete<void>(`/business-lines/${businessLineId}`)
  },

  listMembers(businessLineId: string) {
    return apiHttp.get<BusinessLineMember[]>(`/business-lines/${businessLineId}/members`)
  },

  addMember(businessLineId: string, payload: CreateBusinessLineMemberPayload) {
    return apiHttp.post<BusinessLineMember>(`/business-lines/${businessLineId}/members`, payload)
  },

  createInvitation(businessLineId: string, payload: CreateBusinessLineInvitePayload) {
    return apiHttp.post<BusinessLineInvite>(`/business-lines/${businessLineId}/invitations`, payload)
  },

  getLatestInvitation(businessLineId: string) {
    return apiHttp.get<BusinessLineInvite | null>(`/business-lines/${businessLineId}/invitations/latest`)
  },

  acceptInvitation(payload: AcceptBusinessLineInvitePayload) {
    return apiHttp.post<AcceptBusinessLineInviteResponse>('/business-lines/invitations/accept', payload)
  },

  updateMember(
    businessLineId: string,
    userId: string,
    payload: UpdateBusinessLineMemberPayload,
  ) {
    return apiHttp.patch<BusinessLineMember>(
      `/business-lines/${businessLineId}/members/${userId}`,
      payload,
    )
  },

  removeMember(businessLineId: string, userId: string) {
    return apiHttp.delete<void>(`/business-lines/${businessLineId}/members/${userId}`)
  },
}
