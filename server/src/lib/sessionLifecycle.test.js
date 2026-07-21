import { describe, it, expect } from 'vitest'
import { isActiveSession, sessionsCountingAsCurrent, STALE_IN_PROGRESS_MINUTES } from './sessionLifecycle.js'

const now = new Date('2026-07-21T12:00:00Z')
const minutesAgo = (n) => new Date(now.getTime() - n * 60_000)

describe('isActiveSession', () => {
  it('completed/abandoned 상태면 경과 시간과 무관하게 active가 아니다', () => {
    expect(isActiveSession({ status: 'completed', startedAt: minutesAgo(1) }, now)).toBe(false)
    expect(isActiveSession({ status: 'abandoned', startedAt: minutesAgo(1) }, now)).toBe(false)
  })

  it('in_progress이고 threshold보다 최근이면 active다', () => {
    expect(isActiveSession({ status: 'in_progress', startedAt: minutesAgo(STALE_IN_PROGRESS_MINUTES - 1) }, now)).toBe(true)
  })

  it('in_progress이고 threshold를 넘었으면 active가 아니다(고아 세션 취급)', () => {
    expect(isActiveSession({ status: 'in_progress', startedAt: minutesAgo(STALE_IN_PROGRESS_MINUTES + 1) }, now)).toBe(false)
  })

  it('경계값 — 정확히 threshold 분이 지났으면 active가 아니다', () => {
    expect(isActiveSession({ status: 'in_progress', startedAt: minutesAgo(STALE_IN_PROGRESS_MINUTES) }, now)).toBe(false)
  })
})

describe('sessionsCountingAsCurrent', () => {
  it('completed 세션은 포함한다', () => {
    const sessions = [{ status: 'completed', startedAt: minutesAgo(100) }]
    expect(sessionsCountingAsCurrent(sessions, now)).toEqual(sessions)
  })

  it('최근 in_progress 세션은 포함한다', () => {
    const sessions = [{ status: 'in_progress', startedAt: minutesAgo(1) }]
    expect(sessionsCountingAsCurrent(sessions, now)).toEqual(sessions)
  })

  it('오래된(stale) in_progress 세션은 제외한다', () => {
    const sessions = [{ status: 'in_progress', startedAt: minutesAgo(STALE_IN_PROGRESS_MINUTES + 1) }]
    expect(sessionsCountingAsCurrent(sessions, now)).toEqual([])
  })

  it('abandoned 세션은 제외한다 — 중단 이력만 있고 완료·진행중 세션이 없으면 pending으로 봐야 한다', () => {
    const sessions = [
      { status: 'abandoned', startedAt: minutesAgo(1) },
      { status: 'in_progress', startedAt: minutesAgo(STALE_IN_PROGRESS_MINUTES + 1) }, // stale
    ]
    expect(sessionsCountingAsCurrent(sessions, now)).toEqual([])
  })

  it('빈 배열이면 빈 배열을 반환한다', () => {
    expect(sessionsCountingAsCurrent([], now)).toEqual([])
  })
})
