import type {
  TaskEnvironment,
  TaskEnvironmentStage,
  TaskEnvironmentStatus,
  TaskLog,
  TaskMessage,
} from '@/types/api/tasks'

export function formatTaskDetailDate(value?: string) {
  if (!value) {
    return '-'
  }
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }
  return parsedDate.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function buildEnvironmentSteps(
  status: TaskEnvironmentStatus,
  stage: TaskEnvironmentStage,
  message: string | null,
  failedStage?: TaskEnvironmentStage | null,
): TaskEnvironment['steps'] {
  const stepDefinitions: Array<{ key: TaskEnvironmentStage; label: string }> = [
    { key: 'workspace_preparing', label: '准备任务工作区' },
    { key: 'slot_claiming', label: '分配任务执行资源' },
    { key: 'container_starting', label: '启动执行容器' },
    { key: 'ready', label: '执行环境就绪' },
  ]

  const activeStage = status === 'failed' ? (failedStage ?? 'container_starting') : stage
  const activeIndex = stepDefinitions.findIndex((step) => step.key === activeStage)

  return stepDefinitions.map((step, index) => {
    let stepStatus: TaskEnvironment['steps'][number]['status'] = 'pending'

    if (status === 'ready' || status === 'stopped') {
      stepStatus = 'done'
    } else if (status === 'starting') {
      if (activeIndex > index) {
        stepStatus = 'done'
      } else if (activeIndex === index) {
        stepStatus = 'in_progress'
      }
    } else if (status === 'failed') {
      if (activeIndex > index) {
        stepStatus = 'done'
      } else if (activeIndex === index) {
        stepStatus = 'error'
      }
    }

    return {
      key: step.key,
      label: step.label,
      status: stepStatus,
      message:
        stepStatus === 'in_progress' ||
        stepStatus === 'error' ||
        (status === 'ready' && step.key === 'ready')
          ? message
          : null,
    }
  })
}

export function isAgentOutputLog(log: TaskLog) {
  return (
    log.message === 'Agent CLI stdout chunk' ||
    log.message === 'Agent CLI stderr chunk' ||
    log.level === 'error'
  )
}

export function resolveLogMessageContent(log: TaskLog) {
  const payload = log.payload && typeof log.payload === 'object' ? log.payload : null

  if (
    (log.message === 'Agent CLI stdout chunk' || log.message === 'Agent CLI stderr chunk') &&
    payload &&
    typeof payload.text === 'string' &&
    payload.text.length > 0
  ) {
    return payload.text
  }

  return log.message
}

export function mapLogToMessage(log: TaskLog): TaskMessage {
  const payload = log.payload && typeof log.payload === 'object' ? log.payload : null
  const payloadRole =
    payload && typeof payload.messageRole === 'string' ? payload.messageRole : null

  if (
    payloadRole === 'user' ||
    payloadRole === 'assistant' ||
    payloadRole === 'system' ||
    payloadRole === 'error'
  ) {
    return {
      role: payloadRole,
      content: resolveLogMessageContent(log),
      createdAt: log.createdAt,
      taskNodeId: log.taskNodeId,
      level: log.level,
    }
  }

  if (log.level === 'error') {
    return {
      role: 'error',
      content: resolveLogMessageContent(log),
      createdAt: log.createdAt,
      taskNodeId: log.taskNodeId,
      level: log.level,
    }
  }

  return {
    role: 'system',
    content: resolveLogMessageContent(log),
    createdAt: log.createdAt,
    taskNodeId: log.taskNodeId,
    level: log.level,
  }
}

export function logMessageMatchesAny(
  log: TaskLog,
  messageFragments: readonly string[],
): boolean {
  return messageFragments.some((messageText) => log.message?.includes(messageText))
}
