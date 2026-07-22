import prisma from './prisma.js'
import { buildSessionSummary } from './sessionTurns.js'

/**
 * SessionTurn 배열을 사장님 캘리브레이션 화면이 그리기 쉬운 평평한 형태로 변환한다.
 * DB 접근 없는 순수 함수 — evaluation 안의 필드를 위로 올리고, 없으면 null인 ownerCorrection을 채운다.
 * @param {Array<{id: string, turnNumber: number, retryCount: number, customerMessage: string, staffAnswer: string, passed: boolean, evaluation: object}>} sessionTurns
 */
export function buildTurnCalibrationView(sessionTurns) {
  return sessionTurns.map((turn) => ({
    turnId: turn.id,
    turnNumber: turn.turnNumber,
    retryCount: turn.retryCount,
    customerMessage: turn.customerMessage,
    staffAnswer: turn.staffAnswer,
    passed: turn.passed,
    metItems: turn.evaluation?.metItems ?? [],
    feedback: turn.evaluation?.feedback ?? '',
    improvedAnswer: turn.evaluation?.improvedAnswer ?? '',
    ownerCorrection: turn.evaluation?.ownerCorrection ?? null,
  }))
}

// 원본 metItems에 있는 item 이름만 교정 대상으로 인정한다 — 화면에서 실제로 존재하는 항목만
// 토글할 수 있으니 정상 흐름에서는 전부 통과하고, 임의의 item 이름을 보내는 요청만 조용히 걸러낸다.
function isValidCorrectedItem(entry, validItemNames) {
  return typeof entry?.item === 'string' && validItemNames.has(entry.item) && typeof entry?.met === 'boolean'
}

/**
 * 사장님의 교정을 원본 evaluation 위에 별도 필드(ownerCorrection)로 얹는다. 원본 metItems·feedback·
 * improvedAnswer(AI가 원래 채점한 것)는 절대 건드리지 않는다 — 나중에 원본과 교정을 비교할 수 있어야 한다.
 * @param {object} evaluation 원본 evaluation (변형하지 않음)
 * @param {{ correctedItems?: Array<{item: string, met: boolean}>, comment?: string }} correction
 */
export function applyOwnerCorrection(evaluation, correction) {
  const validItemNames = new Set((evaluation.metItems ?? []).map((m) => m.item))
  const correctedItems = (correction.correctedItems ?? []).filter((entry) => isValidCorrectedItem(entry, validItemNames))
  const comment = typeof correction.comment === 'string' ? correction.comment : ''

  return {
    ...evaluation,
    ownerCorrection: {
      correctedItems,
      comment,
      correctedAt: new Date().toISOString(),
    },
  }
}

/**
 * 매장 전체의 SessionTurn 중 사장님이 실제로 교정을 남긴 것만 골라, 한눈에 볼 수 있는 이력으로
 * 만든다(정정 이력 모아보기). ownerCorrection이 있어도 원본 met 값과 똑같이 제출된 항목은
 * "그냥 확인만 하고 안 바꾼 것"이므로 changedItems에서 뺀다 — 실제로 뒤집힌 것만 눈에 띄게 보여준다.
 * @param {Array<{id, turnNumber, retryCount, evaluation, session: {staff: {name}|null, staffLabel: string|null, scenario: {title}}}>} sessionTurns
 */
export function buildCorrectionHistory(sessionTurns) {
  const rows = []

  for (const turn of sessionTurns) {
    const correction = turn.evaluation?.ownerCorrection
    if (!correction) continue

    const originalByItem = new Map((turn.evaluation.metItems ?? []).map((m) => [m.item, m.met]))
    const changedItems = (correction.correctedItems ?? [])
      .filter((c) => originalByItem.get(c.item) !== c.met)
      .map((c) => ({ item: c.item, originalMet: originalByItem.get(c.item) ?? null, correctedMet: c.met }))

    rows.push({
      turnId: turn.id,
      turnNumber: turn.turnNumber,
      retryCount: turn.retryCount,
      staffName: turn.session.staff?.name ?? turn.session.staffLabel ?? '알 수 없음',
      scenarioTitle: turn.session.scenario.title,
      changedItems,
      comment: correction.comment,
      correctedAt: correction.correctedAt,
    })
  }

  return rows.sort((a, b) => new Date(b.correctedAt) - new Date(a.correctedAt))
}

/**
 * 매장 전체의 완료된 훈련 세션을 "채점 검토" 목록 화면이 그리기 쉬운 형태로 만든다.
 * buildCorrectionHistory와 달리 이미 교정을 남긴 것만 거르지 않고, 완료된 세션 전부를 대상으로 한다
 * (docs/session-review.md — 알바별 최신 세션 1개만 보이던 것과 달리 전체 세션을 골라 들어갈 수 있게).
 * @param {Array<{id, completedAt, scenario: {title}, staff: {name}|null, staffLabel: string|null, sessionTurns: Array}>} sessions
 */
export function buildSessionOverview(sessions) {
  return sessions.map((session) => {
    const { passedCount, totalCount, score } = buildSessionSummary(session.sessionTurns)
    return {
      sessionId: session.id,
      staffName: session.staff?.name ?? session.staffLabel ?? '알 수 없음',
      scenarioTitle: session.scenario.title,
      completedAt: session.completedAt,
      score,
      passedCount,
      totalCount,
      // pickFinalAttempts로 거르지 않은 원본 sessionTurns 전체를 본다 — 캘리브레이션 화면은
      // 재시도 턴까지 전부 개별 카드로 보여주고 그 어느 턴에도 교정을 남길 수 있어서, 최종
      // 시도만 보면 재시도 턴에 남긴 교정을 놓친다.
      hasCorrection: session.sessionTurns.some((t) => Boolean(t.evaluation?.ownerCorrection)),
    }
  })
}

// rubrics.js의 findOwnedRubric과 같은 패턴 — turn -> session -> store 관계를 타고 올라가
// 이 턴이 요청한 사장님의 매장 소속인지 확인한다.
export async function findOwnedTurn(turnId, storeId) {
  const turn = await prisma.sessionTurn.findUnique({ where: { id: turnId }, include: { session: true } })
  if (!turn) {
    return { error: { status: 404, message: 'session turn not found' } }
  }
  if (turn.session.storeId !== storeId) {
    return { error: { status: 403, message: 'session turn does not belong to your store' } }
  }
  return { turn }
}
