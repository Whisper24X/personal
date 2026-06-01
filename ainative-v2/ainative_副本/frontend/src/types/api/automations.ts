export type AutomationStatus = 'active' | 'paused'

export type Automation = {
  id: string
  projectId: string
  name: string
  prompt: string
  rrule: string
  cwds?: string[] | null
  status: AutomationStatus
  lastRunAt?: string | null
  nextRunAt?: string | null
  createdBy?: string | null
  createdAt?: string
  updatedAt?: string
}

export type CreateAutomationPayload = {
  projectId: string
  name: string
  prompt: string
  rrule: string
  cwds?: string[]
  status?: AutomationStatus
}

export type UpdateAutomationPayload = Partial<Omit<CreateAutomationPayload, 'projectId'>>
