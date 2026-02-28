export type User = {
  id: string
  username: string
  nickname?: string | null
  avatar?: string | null
  isAdmin: boolean
  status: number
  createdAt?: string
  updatedAt?: string
}

export type CreateUserPayload = {
  username: string
  password: string
  nickname?: string | null
  avatar?: string | null
  isAdmin?: boolean
  status?: number
}

export type UpdateUserPayload = Partial<CreateUserPayload>
