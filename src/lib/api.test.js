import { describe, it, expect, vi, afterEach } from 'vitest'
import { apiFetch } from './api.js'

describe('apiFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetch 자체가 실패하면(네트워크 단절) 친절한 한국어 문구를 던진다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(apiFetch('/api/health', { auth: false })).rejects.toThrow('네트워크 연결을 확인해주세요.')
  })

  it('정상 응답이면 데이터를 그대로 반환한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      }),
    )

    const result = await apiFetch('/api/health', { auth: false })

    expect(result).toEqual({ ok: true })
  })
})
