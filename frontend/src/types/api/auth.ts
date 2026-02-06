export type LoginRequest = {
  email: string
  password: string
}

export type LoginResponse = {
  accessToken: string
  refreshToken?: string
  user: {
    id: string
    name: string
    email: string
    permissions: string[]
  }
}
