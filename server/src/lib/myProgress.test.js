import { describe, it, expect } from 'vitest'
import { buildRecentTrainingHistory } from './myProgress.js'

function makeSession({ id, completedAt, scenarioTitle, metItems }) {
  return {
    id,
    completedAt,
    scenario: { title: scenarioTitle },
    sessionTurns: [
      {
        turnNumber: 1,
        retryCount: 0,
        evaluation: { metItems },
      },
    ],
  }
}

describe('buildRecentTrainingHistory', () => {
  it('completedAt 내림차순으로 정렬한다', () => {
    const older = makeSession({
      id: 'old',
      completedAt: '2026-07-15T00:00:00.000Z',
      scenarioTitle: '첫 인사 상황',
      metItems: [{ item: 'a', met: true }],
    })
    const newer = makeSession({
      id: 'new',
      completedAt: '2026-07-20T00:00:00.000Z',
      scenarioTitle: '환불 요청 상황',
      metItems: [{ item: 'a', met: true }],
    })

    const result = buildRecentTrainingHistory([older, newer])

    expect(result.map((r) => r.sessionId)).toEqual(['new', 'old'])
  })

  it('limit 개수만큼만 반환한다', () => {
    const sessions = [1, 2, 3].map((n) =>
      makeSession({
        id: `s${n}`,
        completedAt: `2026-07-${10 + n}T00:00:00.000Z`,
        scenarioTitle: `시나리오 ${n}`,
        metItems: [{ item: 'a', met: true }],
      })
    )

    const result = buildRecentTrainingHistory(sessions, 2)

    expect(result).toHaveLength(2)
    expect(result.map((r) => r.sessionId)).toEqual(['s3', 's2'])
  })

  it('각 항목이 sessionId·date·scenarioTitle·score를 담는다 (재입력 없이 한 번에 다 맞히면 100점)', () => {
    const session = makeSession({
      id: 's1',
      completedAt: '2026-07-20T00:00:00.000Z',
      scenarioTitle: '환불 요청 상황',
      metItems: [
        { item: 'a', met: true },
        { item: 'b', met: false },
      ],
    })

    const result = buildRecentTrainingHistory([session])

    expect(result).toEqual([
      {
        sessionId: 's1',
        date: '2026-07-20T00:00:00.000Z',
        scenarioTitle: '환불 요청 상황',
        score: 100,
      },
    ])
  })

  it('아무것도 새로 못 채운 시도(재입력)가 있으면 하트가 깎여 점수가 100점 미만이다', () => {
    const session = {
      id: 's1',
      completedAt: '2026-07-20T00:00:00.000Z',
      scenario: { title: '환불 요청 상황' },
      sessionTurns: [
        { turnNumber: 1, retryCount: 0, evaluation: { metItems: [{ item: 'a', met: false }] } },
        { turnNumber: 1, retryCount: 1, evaluation: { metItems: [{ item: 'a', met: true }] } },
      ],
    }

    const result = buildRecentTrainingHistory([session])

    // maxHearts = 1개 기준 * 2 = 2, 첫 시도(아무것도 못 채움)에서 하트 1개 소모 → 잔량 1/2 = 50점
    expect(result[0].score).toBe(50)
  })

  it('기준이 하나도 채점되지 않은 세션은 score가 null이다', () => {
    const session = makeSession({
      id: 's1',
      completedAt: '2026-07-20T00:00:00.000Z',
      scenarioTitle: '빈 세션',
      metItems: [],
    })

    const result = buildRecentTrainingHistory([session])

    expect(result[0].score).toBeNull()
  })

  it('빈 배열이면 빈 배열을 반환한다', () => {
    expect(buildRecentTrainingHistory([])).toEqual([])
  })

  it('limit 기본값은 5다', () => {
    const sessions = Array.from({ length: 7 }, (_, i) =>
      makeSession({
        id: `s${i}`,
        completedAt: `2026-07-${10 + i}T00:00:00.000Z`,
        scenarioTitle: `시나리오 ${i}`,
        metItems: [{ item: 'a', met: true }],
      })
    )

    expect(buildRecentTrainingHistory(sessions)).toHaveLength(5)
  })
})
