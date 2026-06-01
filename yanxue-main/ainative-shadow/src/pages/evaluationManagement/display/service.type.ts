export interface EvaluationListRequest {
  childName?: string
  courseName?: string
  endTime?: string
  page?: number
  pageSize?: number
  parentName?: string
  phone?: string
  startTime?: string
}

export interface V1EvaluationInfo {
  appointmentId?: string
  childName?: string
  courseName?: string
  courseTime?: string
  createdAt?: string
  dimensionScore?: string[]
  evaluationLabel?: string[]
  feedBack?: string
  feedBackImage?: string[]
  id?: string
  parentName?: string
  phone?: string
  totalScore?: number
  updatedAt?: string
}

export interface EvaluationListResponse {
  list?: V1EvaluationInfo[]
  total?: number
}

export type ExportEvaluationListRequest = Omit<
  EvaluationListRequest,
  'page' | 'pageSize'
>
export interface ExportEvaluationListResponse {
  DownloadUrl?: string
}
