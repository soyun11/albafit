function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Gemini/OpenAI 호출이 일시적으로 실패해도(타임아웃 등) 화면이 바로 멈추지 않게, 짧은 지수
// 백오프로 몇 번 더 시도해본다. sleep을 주입받게 해서 테스트에서 실제로 기다리지 않아도 되게 한다.
export async function withRetry(fn, { retries = 2, baseDelayMs = 300, sleep = defaultSleep } = {}) {
  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt === retries) break
      await sleep(baseDelayMs * 2 ** attempt)
    }
  }
  throw lastError
}
