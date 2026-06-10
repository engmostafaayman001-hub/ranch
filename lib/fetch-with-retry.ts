type RetryableFetchOptions = {
  retries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  retryStatuses?: number[]
}

const DEFAULT_RETRY_STATUSES = [408, 425, 429, 500, 502, 503, 504]

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getRequestMethod(init?: RequestInit) {
  return String(init?.method || 'GET').toUpperCase()
}

function isRetryableNetworkError(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') return true
  if (error instanceof TypeError) return true
  const message = error instanceof Error ? error.message : String(error || '')
  return /failed to fetch|network|connection|reset|timeout|aborted/i.test(message)
}

export async function fetchWithRetry(input: RequestInfo | URL, init: RequestInit = {}, options: RetryableFetchOptions = {}) {
  const method = getRequestMethod(init)
  const retries = options.retries ?? (method === 'GET' ? 3 : 0)
  const baseDelayMs = options.baseDelayMs ?? 350
  const maxDelayMs = options.maxDelayMs ?? 2500
  const retryStatuses = options.retryStatuses ?? DEFAULT_RETRY_STATUSES
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(input, init)
      if (!retryStatuses.includes(response.status) || attempt === retries) return response
      lastError = new Error(`Retryable HTTP ${response.status}`)
    } catch (error) {
      lastError = error
      if (!isRetryableNetworkError(error) || attempt === retries) throw error
    }

    const jitter = Math.floor(Math.random() * 120)
    const delay = Math.min(maxDelayMs, baseDelayMs * (2 ** attempt)) + jitter
    await wait(delay)
  }

  throw lastError instanceof Error ? lastError : new Error('Request failed after retries')
}
