export type EmitUpdate<T> = (event: `update:${string}`, value: T) => void
