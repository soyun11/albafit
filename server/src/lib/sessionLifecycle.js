// 훈련 중단 버튼(POST /api/sessions/:id/abandon)이나 브라우저 종료로 서버에 정리 안 된 세션을
// "진행중"으로 영원히 잘못 세지 않기 위한 기준. 새로고침/탭 닫기는 인증 헤더가 필요한 API를
// beforeunload에서 신뢰성 있게 호출할 방법이 없어서(sendBeacon은 Authorization을 못 실음),
// 쓰기 시점이 아니라 집계(읽기) 시점에 오래된 in_progress를 걸러내는 방식을 쓴다
// (docs/rubric-reuse.md 같은 결정 기록 패턴 — 여기선 별도 문서 없이 이 주석으로 대신함).
export const STALE_IN_PROGRESS_MINUTES = 30

export function isActiveSession(session, now = new Date()) {
  if (session.status !== 'in_progress') return false
  const ageMinutes = (now - new Date(session.startedAt)) / 60_000
  return ageMinutes < STALE_IN_PROGRESS_MINUTES
}

// "이 알바가 지금 pending/active/done 중 뭔지" 판단할 때 실제로 반영해야 하는 세션만 남긴다.
// abandoned(중단)는 "지금 하고 있다"는 근거가 아니라서 completed처럼 취급하면 안 되고, 그렇다고
// "제외하면 안 되는 세션"에도 안 들어가서 걸러야 한다 — 안 그러면 완료 이력이 하나도 없는데도
// 예전에 중단한 세션 하나 때문에 "active"로 잘못 표시된다(실제로 겪은 버그).
export function sessionsCountingAsCurrent(sessions, now = new Date()) {
  return sessions.filter((s) => s.status === 'completed' || isActiveSession(s, now))
}
