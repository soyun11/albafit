// 재입력(같은 turnNumber에 여러 row)이 있어도, 그 턴에서 "최종적으로 확정된 attempt" 하나만 골라준다.
// DB 반환 순서에 의존하지 않고 retryCount가 가장 큰 row를 그 턴의 결론으로 본다.
// sessions.js(손님 에이전트에 넘길 history)와 stores.js(리포트 집계) 양쪽에서 재사용한다.
export function pickFinalAttempts(sessionTurns) {
  const byTurnNumber = new Map()
  for (const turn of sessionTurns) {
    const current = byTurnNumber.get(turn.turnNumber)
    if (!current || turn.retryCount > current.retryCount) {
      byTurnNumber.set(turn.turnNumber, turn)
    }
  }
  return [...byTurnNumber.values()].sort((a, b) => a.turnNumber - b.turnNumber)
}

// 손님 에이전트에게 넘길 대화 기록을 만든다. pickFinalAttempts와 달리 여기서는 재입력 시도를
// 버리지 않는다 — 화면에 실제로 보인 대화 그대로(손님 질문 1번 + 그 턴 안에서 알바가 답한 시도들
// 전부)를 순서대로 넘겨야, 손님이 "아까 이미 들은 얘기"를 다시 캐묻지 않는다. 재입력으로 답이
// 여러 번 나뉘어도(예: "죄송합니다" → "10분 정도 걸려요" → "리필도 됩니다") 그 셋 다 대화에 남는다.
export function buildConversationHistory(sessionTurns) {
  const byTurnNumber = new Map()
  for (const turn of sessionTurns) {
    if (!byTurnNumber.has(turn.turnNumber)) byTurnNumber.set(turn.turnNumber, [])
    byTurnNumber.get(turn.turnNumber).push(turn)
  }

  const history = []
  for (const [, attempts] of [...byTurnNumber.entries()].sort((a, b) => a[0] - b[0])) {
    attempts.sort((a, b) => a.retryCount - b.retryCount)
    history.push({ sender: 'customer', text: attempts[0].customerMessage })
    for (const attempt of attempts) {
      history.push({ sender: 'staff', text: attempt.staffAnswer })
    }
  }
  return history
}

// 하트(재입력 예산) 계산용 — 지금까지의 시도(재입력 포함, 턴 안 재시도까지 전부) 중에서 "새로
// 충족시킨 기준이 하나도 없었던" 시도가 몇 번이었는지 센다. 시간 순서대로 다시 훑으면서, 그 시점까지
// 누적된 충족 기준 집합과 비교해 "이 시도가 뭔가 새로 채웠는지"를 판단한다. "엉뚱한 대답"(기준을
// 하나도 못 채운 답)만 하트를 깎고, 일부라도 새로 채웠으면 안 깎는다는 규칙을 그대로 구현한 것.
function countOffTopicAttempts(sessionTurns) {
  const sorted = [...sessionTurns].sort((a, b) => a.turnNumber - b.turnNumber || a.retryCount - b.retryCount)
  const everMet = new Set()
  let offTopicCount = 0
  for (const t of sorted) {
    const metItems = t.evaluation?.metItems ?? []
    const newlyMet = metItems.some((m) => m.met && !everMet.has(m.item))
    if (!newlyMet) offTopicCount++
    for (const m of metItems) if (m.met) everMet.add(m.item)
  }
  return offTopicCount
}

// 이번 턴 제출이 세션을 어떻게 진행시켜야 하는지 판정한다(docs/multi-turn-conversation-fix.md).
// "이번 답 하나가 필수 기준을 전부 커버했는가"가 아니라 "이번 답이 이전에 없던 기준을 하나라도 새로
// 채웠는가"(madeProgress)로 재입력 여부를 가른다 — 그래야 부분 진전일 때 같은 질문을 무한 재입력시키지
// 않고 손님이 다음 대사로 넘어갈 수 있다(그 전엔 이 둘의 기준이 같아서, 통과하는 순간 항상 전체
// 완료 조건도 같이 만족돼버려 손님이 다음 말을 하는 코드 경로가 사실상 실행될 수 없었다).
// 턴 개수 자체에는 상한을 두지 않는다(예전엔 MAX_TURNS로 강제 종료했었는데, 필수 기준이 4개인
// AI 생성 루브릭에서 알바가 실수 하나 없이 진전해도 3턴 만에 다 못 채우는 문제가 있었다 —
// docs/multi-turn-conversation-fix.md). 하트가 "나쁜(진전 없는) 시도" 횟수를, allCriteriaMet이
// "충분히 진전했는지"를 이미 각자 책임지고 있어서, 둘 다 문제없다면 세션이 계속 이어지는 게 맞다.
// @param {{ madeProgress: boolean, everMetItems: Set<string>, requiredItems: string[], heartsExhausted: boolean }} params
// @returns {{ retryNeeded: boolean, completed: boolean, allCriteriaMet: boolean }}
export function decideTurnOutcome({ madeProgress, everMetItems, requiredItems, heartsExhausted }) {
  if (heartsExhausted) {
    return { retryNeeded: false, completed: true, allCriteriaMet: false }
  }
  if (!madeProgress) {
    return { retryNeeded: true, completed: false, allCriteriaMet: false }
  }

  const allCriteriaMet = requiredItems.every((item) => everMetItems.has(item))
  return { retryNeeded: false, completed: allCriteriaMet, allCriteriaMet }
}

// 하트 1개당 루브릭 기준 몇 개분인지 — 기준이 많은(복잡한) 시나리오일수록 하트도 비례해서 늘어난다.
export const HEARTS_PER_CRITERION = 2

// sessionTurns(재입력 시도 전부 포함, 방금 만든 turn까지 포함해서 넘기면 됨)만 가지고 하트 상태를
// 계산한다. 이 세션이 실제로 쓴 채점 기준 개수(evaluation.metItems에 등장한 서로 다른 item 텍스트
// 수)를 그대로 "기준 개수"로 쓴다 — 루브릭을 별도로 다시 조회하지 않는 이유는, 그 사이 "기준
// 재설정"으로 루브릭이 바뀌었어도 이 세션이 실제로 채점받은 기준 그대로를 봐야 하기 때문이다
// (/me/staff/:staffId/latest-report의 체크리스트 계산과 같은 원칙).
export function computeHearts(sessionTurns) {
  const criteriaSeen = new Set(pickFinalAttempts(sessionTurns).flatMap((t) => t.evaluation?.metItems ?? []).map((m) => m.item))
  const maxHearts = criteriaSeen.size * HEARTS_PER_CRITERION
  const heartsLost = countOffTopicAttempts(sessionTurns)
  return { maxHearts, heartsRemaining: Math.max(0, maxHearts - heartsLost) }
}

// buildSessionReportPayload(전체 체크리스트)와 buildSessionSummary(목록용 요약 숫자) 둘 다 같은
// "라벨 집계 + 하트 계산"이 필요해서 한 곳에 모아둔다 — 점수 계산 규칙(하트 잔량 비율)이 두 곳에서
// 갈리면 목록에서 본 점수와 리포트에서 본 점수가 달라 보이는 문제가 생긴다.
function summarizeSessionTurns(sessionTurns) {
  const allLabels = new Set()
  const metLabels = new Set()
  for (const turn of pickFinalAttempts(sessionTurns)) {
    for (const item of turn.evaluation?.metItems ?? []) {
      allLabels.add(item.item)
      if (item.met) metLabels.add(item.item)
    }
  }
  const { maxHearts, heartsRemaining } = computeHearts(sessionTurns)
  const score = maxHearts > 0 ? Math.round((heartsRemaining / maxHearts) * 100) : null
  return { allLabels, metLabels, maxHearts, heartsRemaining, score }
}

// 리포트 화면(FeedbackReport.jsx)이 그리는 데이터 그대로 만든다. staffName/industry는 세션이
// "이 알바의 최신 세션"으로 찾아졌는지("/me/staff/:staffId/latest-report") 아니면 세션id로 직접
// 찾아졌는지("/api/sessions/:id/report")에 따라 호출부가 미리 다르게 알아내서 넘긴다 — 이 함수는
// 그 차이를 몰라도 되게 순수 계산만 한다.
// @param {{ session: {id, startedAt, completedAt, scenario: {title}, sessionTurns: Array}, staffName: string, industry: string|null }} params
export function buildSessionReportPayload({ session, staffName, industry }) {
  const { allLabels, metLabels, maxHearts, heartsRemaining } = summarizeSessionTurns(session.sessionTurns)
  const checklist = [...allLabels].map((label) => ({ label, status: metLabels.has(label) ? 'ok' : 'wait' }))
  const durationMinutes = session.completedAt
    ? Math.max(1, Math.round((session.completedAt - session.startedAt) / 60000))
    : null

  return {
    sessionId: session.id,
    checklist,
    scenarioTitle: session.scenario.title,
    staffName,
    durationMinutes,
    industry,
    heartsRemaining,
    maxHearts,
  }
}

// "채점 검토" 목록(SessionReview.jsx)이 세션마다 보여줄 요약 숫자 — 전체 체크리스트는 필요 없고
// 개수·점수만 있으면 된다. 기준을 하나도 안 쓴 세션(maxHearts 0)은 점수를 매길 수 없어 null.
export function buildSessionSummary(sessionTurns) {
  const { allLabels, metLabels, score } = summarizeSessionTurns(sessionTurns)
  return { passedCount: metLabels.size, totalCount: allLabels.size, score }
}
