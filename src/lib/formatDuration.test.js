import { describe, it, expect } from 'vitest'
import { formatDuration } from './formatDuration.js'

describe('formatDuration', () => {
  it('1분 미만이면 초만 보여준다', () => {
    expect(formatDuration(45)).toBe('45초')
  })

  it('1분 이상이면 분과 초를 같이 보여준다', () => {
    expect(formatDuration(83)).toBe('1분 23초')
  })

  it('null이면 null을 그대로 돌려준다(호출부가 자리표시자를 그리게)', () => {
    expect(formatDuration(null)).toBeNull()
  })
})
