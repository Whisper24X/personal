import type { InfinityPaginationResponse } from '@/api/http'

type FetchAllPagesOptions = {
  limit?: number
  maxPages?: number
}

export const fetchAllPages = async <T>(
  fetchPage: (page: number, limit: number) => Promise<InfinityPaginationResponse<T>>,
  options?: FetchAllPagesOptions,
): Promise<T[]> => {
  const limit = options?.limit ?? 50
  const maxPages = options?.maxPages ?? 20

  const result: T[] = []
  let page = 1
  let hasNextPage = true

  while (hasNextPage && page <= maxPages) {
    const response = await fetchPage(page, limit)
    result.push(...response.data)
    hasNextPage = response.hasNextPage
    page += 1
  }

  return result
}
