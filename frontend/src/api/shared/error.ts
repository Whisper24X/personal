export class HttpError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

type ErrorResponseBody = {
  message?: string | string[]
  errors?: unknown
  status?: number
  statusCode?: number
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const flattenErrorMessages = (value: unknown): string[] => {
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()]
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenErrorMessages(item))
  }

  if (isRecord(value)) {
    return Object.values(value).flatMap((item) => flattenErrorMessages(item))
  }

  return []
}

export const extractHttpErrorMessage = (body: unknown, fallback: string) => {
  if (!isRecord(body)) {
    return fallback
  }

  const payload = body as ErrorResponseBody
  const errors = flattenErrorMessages(payload.errors)
  const status = payload.statusCode ?? payload.status
  if (status === 422 && errors.length > 0) {
    return errors.join('，')
  }

  const message = flattenErrorMessages(payload.message)
  if (message.length > 0) {
    return message.join('，')
  }

  if (errors.length > 0) {
    return errors.join('，')
  }

  return fallback
}
