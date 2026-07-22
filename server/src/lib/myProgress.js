import { computeHearts } from './sessionTurns.js'

/**
 * 완료된 세션들 중 최근 것부터 limit개를 알바 본인용 "최근 훈련 기록"으로 변환한다.
 * 점수는 사장님 리포트(staff-report/latest-report)와 같은 기준(하트 잔량 비율)으로 계산해
 * 같은 세션을 사장님이 봐도 같은 점수가 나오게 한다.
 * @param {Array<{id, completedAt, scenario: {title}, sessionTurns: Array}>} completedSessions
 * @param {number} limit
 */
export function buildRecentTrainingHistory(completedSessions, limit = 5) {
  return [...completedSessions]
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
    .slice(0, limit)
    .map((session) => {
      const { maxHearts, heartsRemaining } = computeHearts(session.sessionTurns)
      const score = maxHearts > 0 ? Math.round((heartsRemaining / maxHearts) * 100) : null
      return {
        sessionId: session.id,
        date: session.completedAt,
        scenarioTitle: session.scenario.title,
        score,
      }
    })
}
