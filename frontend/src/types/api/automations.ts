export type AutomationStatus = 'active' | 'paused'

export type Automation = {
  id: string
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
  name: string
  prompt: string
  rrule: string
  cwds?: string[]
  status?: AutomationStatus
}

export type UpdateAutomationPayload = Partial<CreateAutomationPayload>
