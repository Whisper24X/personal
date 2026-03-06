export type User = {
  id: string
  username: string
  nickname?: string | null
  avatar?: string | null
  createdAt?: string
  updatedAt?: string
}

export type CreateUserPayload = {
  username: string
  password: string
  nickname?: string | null
  avatar?: string | null
}

export type UpdateUserPayload = Partial<CreateUserPayload>
