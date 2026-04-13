/**
 * 判断 fetch 失败是否由刷新、关闭标签页或 SPA 切页导致请求被中断。
 * 此类情况下不应清理「生成中」的 localStorage，否则后台仍在生成时刷新会误删 pending。
 */
export function isRequestPreemptedFetchError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return true
  }
  const msg =
    error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  if (error instanceof TypeError && /failed to fetch|load failed|networkerror|terminated|aborted|cancel/i.test(msg)) {
    return true
  }
  return false
}
