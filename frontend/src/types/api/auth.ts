export type LoginRequest = {
  username: string
  password: string
}

export type RegisterRequest = {
  username: string
  password: string
  nickname?: string
}

export type UserInfo = {
  id: string
  username: string
  nickname?: string | null
  avatar?: string | null
  isAdmin: boolean
  status: number
}

export type LoginResponse = {
  token: string
  refreshToken: string
  tokenExpires: number
  user: UserInfo
}

export type UpdateMePayload = Partial<{
  username: string
  nickname: string
  avatar: string
  oldPassword: string
  password: string
}>
