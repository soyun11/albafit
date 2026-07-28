import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/requireAuth.js'
import { getCustomerReplyForScenario, getOpeningLineForScenario } from '../lib/customerAgent.js'
import { evaluateTurn } from '../lib/evaluator.js'
import { runCrossCheck } from '../lib/evaluatorCrossCheck.js'
import { pickFinalAttempts, buildConversationHistory, computeHearts, decideTurnOutcome, buildSessionReportPayload } from '../lib/sessionTurns.js'
import { belongsToStaff } from '../lib/staffMatch.js'
import { findOwnedTurn, applyOwnerCorrection, buildTurnCalibrationView } from '../lib/evaluationCalibration.js'

const router = Router()

// ============================================================
// 훈련 세션 시작 — POST /api/sessions
// 승인된 루브릭이 있는 시나리오에서만 시작할 수 있다("AI는 생성, 사장님은 승인" 게이트).
// ============================================================
router.post('/', requireAuth, async (req, res) => {
  const { scenarioId, staffLabel } = req.body ?? {}

  if (!req.user.storeId) {
    return res.status(400).json({ error: 'no store linked to this account' })
  }
  if (typeof scenarioId !== 'string') {
    return res.status(400).json({ error: 'scenarioId is required' })
  }

  try {
    // findFirst({storeId, type}) 대신 findUnique(id)로 바뀜 — type은 더 이상 조회 키가 아니라
    // 그냥 순번(scenario-1, scenario-2...)이라 여러 매장에 겹칠 수 있다. id로 정확히 하나를 집고,
    // 그 시나리오가 실제로 이 매장 것인지(소유권)는 별도로 확인한다 — 남의 매장 scenarioId를
    // 넣어서 훈련을 시작하는 걸 막기 위해.
    const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId } })
    if (!scenario || scenario.storeId !== req.user.storeId) {
      return res.status(404).json({ error: 'scenario not found for this store' })
    }

    const rubric = await prisma.rubric.findFirst({
      where: { scenarioId: scenario.id, approvedAt: { not: null } },
      orderBy: { version: 'desc' },
    })
    if (!rubric) {
      return res.status(400).json({ error: 'rubric not approved yet' })
    }

    const session = await prisma.trainingSession.create({
      data: {
        storeId: req.user.storeId,
        scenarioId: scenario.id,
        ...(staffLabel !== undefined && { staffLabel }),
        // 로그인한 알바 계정을 실제로 식별하는 값 — staffLabel(자유 텍스트)만으로는 동명이인을
        // 구분 못 해 리포트 집계가 섞이는 문제가 있었다(server/src/lib/staffMatch.js).
        ...(req.user.role === 'staff' && { staffId: req.user.id }),
      },
    })

    return res.status(201).json({
      session,
      scenario: { id: scenario.id, title: scenario.title },
      rubric: { id: rubric.id, criteria: rubric.criteria },
      openingLine: getOpeningLineForScenario(scenario),
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'failed to start session' })
  }
})

// ============================================================
// 턴 제출 — POST /api/sessions/:id/turns
// 이번 손님 발화(customerMessage)에 대한 알바 답변을 채점하고, 다음 손님 발화를 생성해 돌려준다.
// ============================================================
router.post('/:id/turns', requireAuth, async (req, res) => {
  const { customerMessage, staffAnswer } = req.body ?? {}

  if (typeof customerMessage !== 'string' || typeof staffAnswer !== 'string' || staffAnswer.trim().length === 0) {
    return res.status(400).json({ error: 'customerMessage and staffAnswer are required' })
  }

  try {
    const session = await prisma.trainingSession.findUnique({
      where: { id: req.params.id },
      // 재입력이 생기면 같은 turnNumber에 row가 여러 개 쌓이므로, retryCount까지 정렬 기준에 넣어
      // 항상 "턴 순서 → 그 턴 안 시도 순서"로 안정적으로 정렬되게 한다.
      include: { scenario: true, sessionTurns: { orderBy: [{ turnNumber: 'asc' }, { retryCount: 'asc' }] } },
    })
    if (!session || session.storeId !== req.user.storeId) {
      return res.status(404).json({ error: 'session not found' })
    }
    if (session.status === 'completed') {
      return res.status(400).json({ error: 'session already completed' })
    }

    const rubric = await prisma.rubric.findFirst({
      where: { scenarioId: session.scenarioId, approvedAt: { not: null } },
      orderBy: { version: 'desc' },
    })
    if (!rubric) {
      return res.status(400).json({ error: 'rubric not approved yet' })
    }

    // 재입력 판별 — 클라이언트가 "이건 재입력이에요"라고 따로 알려주지 않는다. 이 세션의 마지막
    // row가 "같은 손님 질문에 대해 아직 통과 못 했음"이면 이번 제출을 그 턴의 재입력으로 본다.
    // 재입력 횟수 자체에는 더 이상 턴별 상한이 없다 — 세션 전체 하트가 다 떨어지기 전까지는 같은
    // 질문을 계속 다시 시도할 수 있다(하트 소진 시 세션 자체가 끝나므로 아래에서 별도로 처리).
    const lastTurn = session.sessionTurns.at(-1)
    const isRetry = !!lastTurn && lastTurn.passed === false

    const turnNumber = isRetry ? lastTurn.turnNumber : (lastTurn?.turnNumber ?? 0) + 1
    const retryCount = isRetry ? lastTurn.retryCount + 1 : 0
    // 재입력이면 클라이언트가 보낸 값 대신 직전 시도의 손님 질문을 그대로 쓴다 — "같은 질문에
    // 다시 답한다"는 전제를 서버가 직접 보장한다(클라이언트 상태가 어긋나도 DB엔 항상 일관되게 남음).
    const effectiveCustomerMessage = isRetry ? lastTurn.customerMessage : customerMessage

    // 이 시도 이전까지(다른 turnNumber 전부 + 같은 turnNumber의 이전 재입력) 확정된 met 기준.
    // pickFinalAttempts가 turnNumber별 "최종 확정 시도"만 골라주는데, 재입력 시도의 evaluation도
    // 항상 그 시점까지의 누적 결과를 담고 있어서(아래 evaluateTurn이 previouslyMetItems를 강제
    // 반영해 저장하므로) 이 한 번의 계산만으로 재입력 케이스까지 자연히 커버된다 — 예전엔 "같은 턴
    // 재입력"과 "다른 턴"을 따로 계산했었다.
    // AI 채점 프롬프트에도 그대로 넘긴다 — 안 넘기면 이전 턴에 이미 확인된 내용을 이번 턴 답변만
    // 보고 "누락됐다"고 잘못 지적하는 피드백 문장이 나간다(체크리스트 자체는 늘 정확했지만, 화면에
    // 보이는 자연어 피드백이 앞선 대화를 기억 못 하는 것처럼 보이던 문제).
    const priorMetItems = new Set(
      pickFinalAttempts(session.sessionTurns).flatMap((t) => t.evaluation?.metItems ?? []).filter((m) => m.met).map((m) => m.item)
    )

    const evaluation = await evaluateTurn({
      criteria: rubric.criteria,
      customerMessage: effectiveCustomerMessage,
      staffAnswer,
      previouslyMetItems: [...priorMetItems],
    })

    const madeProgress = evaluation.metItems.some((m) => m.met && !priorMetItems.has(m.item))

    const turn = await prisma.sessionTurn.create({
      data: {
        sessionId: session.id,
        turnNumber,
        retryCount,
        customerMessage: effectiveCustomerMessage,
        staffAnswer,
        evaluation,
        // evaluation.passed(이 답 하나가 필수 기준을 전부 커버했는가)가 아니라 madeProgress를 저장한다 —
        // 다음 요청의 isRetry 판정(위 110행)이 이 값을 그대로 쓰기 때문에, 아래 retryNeeded와 반드시
        // 같은 기준이어야 한다(docs/multi-turn-conversation-fix.md).
        passed: madeProgress,
      },
    })

    // 기능강화② 평가 결과 교차검증(docs/evaluation-cross-check.md) — 응답을 기다리게 하면 안
    // 되므로 await 없이 fire-and-forget으로 실행하고 실패는 여기서 격리한다. 참고 로그일 뿐
    // 턴 판정(passed/재입력/하트)에는 전혀 관여하지 않는다.
    runCrossCheck({
      turnId: turn.id,
      criteria: rubric.criteria,
      customerMessage: effectiveCustomerMessage,
      staffAnswer,
      geminiMetItems: evaluation.metItems,
    }).catch((err) => console.error('[cross-check] failed', err))

    // 하트(재입력 예산) — 세션 전체를 통틀어 "새로 충족시킨 기준이 하나도 없었던" 시도 횟수만큼
    // 깎인다. 방금 만든 turn까지 포함해서 계산해야 이번 시도가 하트에 반영된다.
    const { maxHearts, heartsRemaining } = computeHearts([...session.sessionTurns, turn])
    const heartsExhausted = heartsRemaining <= 0

    // everMetItems — 이 턴까지 포함해 세션 전체에서 한 번이라도 충족된 기준 전부(재입력 포함, 최종
    // 확정 시도 기준). decideTurnOutcome의 allCriteriaMet 판정에 쓴다.
    const everMetItems = new Set(
      pickFinalAttempts([...session.sessionTurns, turn]).flatMap((t) => t.evaluation?.metItems ?? []).filter((m) => m.met).map((m) => m.item)
    )
    const requiredItems = rubric.criteria.filter((c) => c.required).map((c) => c.item)

    const outcome = decideTurnOutcome({ madeProgress, everMetItems, requiredItems, heartsExhausted })
    const { retryNeeded, completed, allCriteriaMet } = outcome

    let nextCustomerMessage = null
    let durationSeconds = null

    if (completed) {
      const completedAt = new Date()
      await prisma.trainingSession.update({
        where: { id: session.id },
        data: { status: 'completed', completedAt },
      })
      // 리포트 화면의 "총 훈련 시간" — 예전엔 "18분"으로 고정돼있던 값을 실제 시작~완료 시각 차이로 계산.
      durationSeconds = Math.round((completedAt - session.startedAt) / 1000)
    } else if (!retryNeeded) {
      // 진전은 있었지만 아직 필수 기준을 다 못 채웠다 — 손님이 다음 대사를 한다. 턴 개수 자체에는
      // 상한이 없다(하트가 나쁜 시도를, allCriteriaMet이 충분한 진전을 이미 책임진다).
      // 손님 에이전트에는 화면에 실제로 보인 대화 그대로 넘긴다 — 재입력으로 답이 여러 번
      // 나뉘었어도(방금 만든 turn까지 포함) 그 시도들을 다 포함해야, 손님이 이미 들은 내용을
      // 다시 캐묻지 않는다(pickFinalAttempts는 리포트 집계처럼 "최종 결론 하나"만 필요할 때만 쓴다).
      const history = buildConversationHistory([...session.sessionTurns, turn])

      nextCustomerMessage = await getCustomerReplyForScenario({
        situation: session.scenario.persona?.situation,
        criteria: rubric.criteria,
        history,
      })
    }

    return res.status(201).json({
      turn,
      evaluation,
      nextCustomerMessage,
      completed,
      allCriteriaMet,
      retryNeeded,
      heartsRemaining,
      maxHearts,
      heartsExhausted,
      durationSeconds,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'failed to submit turn' })
  }
})

// ============================================================
// 훈련 중단 — POST /api/sessions/:id/abandon
// "훈련 중단" 버튼(중간 이탈)에서 호출 — status를 abandoned로 정리해, 사장님 대시보드 집계에서
// 이 세션이 계속 "진행중"으로 잘못 잡히지 않게 한다(server/src/lib/sessionLifecycle.js와 짝).
// ============================================================
router.post('/:id/abandon', requireAuth, async (req, res) => {
  try {
    const session = await prisma.trainingSession.findUnique({ where: { id: req.params.id } })
    if (!session || session.storeId !== req.user.storeId || !belongsToStaff(session, req.user)) {
      return res.status(404).json({ error: 'session not found' })
    }

    // 이미 완료됐거나 이미 중단 처리된 세션이면 그대로 성공 취급 — 중복 호출을 에러로 보지 않는다.
    if (session.status !== 'in_progress') {
      return res.json({ session })
    }

    const updated = await prisma.trainingSession.update({
      where: { id: session.id },
      data: { status: 'abandoned' },
    })
    return res.json({ session: updated })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'failed to abandon session' })
  }
})

// ============================================================
// 평가 캘리브레이션 — PATCH /api/sessions/turns/:turnId/calibration (사장님 전용)
// 사장님이 Gemini 채점(evaluation.metItems)이 틀렸다고 판단한 항목을 직접 교정한다.
// 원본 AI 판정은 그대로 두고 evaluation.ownerCorrection에 별도로 남긴다
// (docs/evaluation-calibration.md "결정" 표 참고).
// ============================================================
router.patch('/turns/:turnId/calibration', requireAuth, requireRole('owner'), async (req, res) => {
  const { correctedItems, comment } = req.body ?? {}

  try {
    const { turn, error } = await findOwnedTurn(req.params.turnId, req.user.storeId)
    if (error) {
      return res.status(error.status).json({ error: error.message })
    }

    const evaluation = applyOwnerCorrection(turn.evaluation, { correctedItems, comment })

    const updated = await prisma.sessionTurn.update({
      where: { id: turn.id },
      data: { evaluation },
    })
    return res.json(updated)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'failed to save calibration' })
  }
})

// ============================================================
// 세션 조회 — GET /api/sessions/:id (리포트 화면용)
// ============================================================
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const session = await prisma.trainingSession.findUnique({
      where: { id: req.params.id },
      include: { scenario: true, sessionTurns: { orderBy: [{ turnNumber: 'asc' }, { retryCount: 'asc' }] } },
    })
    if (!session || session.storeId !== req.user.storeId) {
      return res.status(404).json({ error: 'session not found' })
    }
    // turns — 캘리브레이션 화면(TurnCalibrationReview.jsx)이 바로 그리기 쉬운 평평한 형태.
    // 기존 session.sessionTurns(원본 Prisma 형태)는 다른 소비자를 위해 그대로 둔다.
    return res.json({ ...session, turns: buildTurnCalibrationView(session.sessionTurns) })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'failed to fetch session' })
  }
})

// ============================================================
// 세션 하나의 리포트 데이터 — GET /api/sessions/:id/report (사장님 전용)
// "채점 검토"(전체 세션 목록, stores.js의 /me/sessions)에서 세션 하나를 골랐을 때, 그 알바의
// "최신 세션"이 아니라 그 세션 자체의 리포트를 보여주기 위한 용도 — /me/staff/:staffId/latest-report와
// 같은 계산(buildSessionReportPayload)을 세션id 기준으로 재사용한다.
// ============================================================
router.get('/:id/report', requireAuth, requireRole('owner'), async (req, res) => {
  try {
    const session = await prisma.trainingSession.findUnique({
      where: { id: req.params.id },
      include: { scenario: true, sessionTurns: true, staff: true, store: true },
    })
    if (!session || session.storeId !== req.user.storeId) {
      return res.status(404).json({ error: 'session not found' })
    }
    return res.json(
      buildSessionReportPayload({
        session,
        staffName: session.staff?.name ?? session.staffLabel ?? '알 수 없음',
        industry: session.store?.industry ?? null,
      }),
    )
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'failed to fetch session report' })
  }
})

export default router
