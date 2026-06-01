export const storage = {
  get<T>(key: string): T | null {
    const raw = localStorage.getItem(key)
    if (!raw) return null

    try {
      return JSON.parse(raw) as T
    } catch {
      return raw as T
    }
  },

  set<T>(key: string, value: T) {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    localStorage.setItem(key, serialized)
  },

  remove(key: string) {
    localStorage.removeItem(key)
  },
}
