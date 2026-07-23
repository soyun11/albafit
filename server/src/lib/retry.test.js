import { describe, it, expect, vi } from 'vitest'
import { withRetry } from './retry.js'

describe('withRetry', () => {
  it('첫 시도에 성공하면 재시도 없이 결과를 반환한다', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const sleep = vi.fn().mockResolvedValue()

    const result = await withRetry(fn, { sleep })

    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('한 번 실패하고 다음에 성공하면 재시도해서 결과를 반환한다', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('일시 오류')).mockResolvedValueOnce('ok')
    const sleep = vi.fn().mockResolvedValue()

    const result = await withRetry(fn, { retries: 2, sleep })

    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledTimes(1)
  })

  it('retries만큼 다 실패하면 마지막 에러를 그대로 던진다', async () => {
    const err = new Error('계속 실패')
    const fn = vi.fn().mockRejectedValue(err)
    const sleep = vi.fn().mockResolvedValue()

    await expect(withRetry(fn, { retries: 2, sleep })).rejects.toThrow('계속 실패')
    expect(fn).toHaveBeenCalledTimes(3) // 최초 시도 1 + 재시도 2
    expect(sleep).toHaveBeenCalledTimes(2)
  })

  it('retries: 0이면 재시도 없이 첫 실패를 바로 던진다', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('실패'))
    const sleep = vi.fn().mockResolvedValue()

    await expect(withRetry(fn, { retries: 0, sleep })).rejects.toThrow('실패')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('재시도 간격은 지수 백오프로 늘어난다', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('실패'))
    const sleep = vi.fn().mockResolvedValue()

    await expect(withRetry(fn, { retries: 2, baseDelayMs: 100, sleep })).rejects.toThrow()

    expect(sleep).toHaveBeenNthCalledWith(1, 100)
    expect(sleep).toHaveBeenNthCalledWith(2, 200)
  })
})
