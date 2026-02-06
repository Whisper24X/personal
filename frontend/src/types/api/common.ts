export type ApiResponse<T> = {
  success: boolean
  data: T
  message?: string
}

export type ApiError = {
  status: number
  message: string
}
