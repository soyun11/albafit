import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/requireAuth.js'
import { getCustomerReplyForScenario, getOpeningLineForScenario } from '../lib/customerAgent.js'
import { evaluateTurn } from '../lib/evaluator.js'
import { runCrossCheck } from '../lib/evaluatorCrossCheck.js'
import { pickFinalAttempts, buildConversationHistory, computeHearts, buildSessionReportPayload } from '../lib/sessionTurns.js'
import { belongsToStaff } from '../lib/staffMatch.js'
import { findOwnedTurn, applyOwnerCorrection, buildTurnCalibrationView } from '../lib/evaluationCalibration.js'

const router = Router()

// 오늘은 시나리오 하나당 이 턴 수를 채우면 훈련 종료로 본다. 프론트 mock(TrainingSession.jsx)의
// "오프닝 + 2턴" 구조와 맞춘 값이라, 나중에 시나리오별로 다르게 하고 싶으면 이 상수를 분기하면 된다.
const MAX_TURNS = 3

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

    // 재입력이면 같은 turnNumber의 이전 시도들에서 이미 충족했던 기준을 모아 이번 채점에 반영한다 —
    // 그래야 이미 잘한 부분을 재입력 채점에서 또 "미충족"이라고 지적하지 않는다.
    const previouslyMetItems = isRetry
      ? [
          ...new Set(
            session.sessionTurns
              .filter((t) => t.turnNumber === turnNumber)
              .flatMap((t) => t.evaluation?.metItems ?? [])
              .filter((m) => m.met)
              .map((m) => m.item)
          ),
        ]
      : []

    const evaluation = await evaluateTurn({
      criteria: rubric.criteria,
      customerMessage: effectiveCustomerMessage,
      staffAnswer,
      previouslyMetItems,
    })

    const turn = await prisma.sessionTurn.create({
      data: {
        sessionId: session.id,
        turnNumber,
        retryCount,
        customerMessage: effectiveCustomerMessage,
        staffAnswer,
        evaluation,
        passed: evaluation.passed,
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

    let nextCustomerMessage = null
    let durationMinutes = null
    let completed = false
    let allCriteriaMet = false
    let retryNeeded = false

    if (heartsExhausted) {
      // 하트를 다 썼다 — 지금 이 턴을 통과했는지와 무관하게 훈련 전체를 여기서 즉시 끝낸다.
      completed = true
      const completedAt = new Date()
      await prisma.trainingSession.update({
        where: { id: session.id },
        data: { status: 'completed', completedAt },
      })
      durationMinutes = Math.max(1, Math.round((completedAt - session.startedAt) / 60000))
    } else {
      // 하트가 남아있으면, 통과 못 한 턴은 재입력이 필요한 상태로 응답하고 턴을 넘기지 않는다 —
      // 재입력 자체에는 더 이상 별도 상한이 없다(위 하트 계산이 사실상의 상한 역할을 한다).
      retryNeeded = !evaluation.passed

      if (!retryNeeded) {
        // 이 시나리오의 루브릭 기준을 세션 전체(턴을 넘나들며)에서 한 번이라도 다 충족했으면, 남은
        // 턴을 억지로 더 채우지 않고 바로 끝낸다 — 이미 다 확인된 것을 손님이 계속 캐묻게 하지 않기 위해.
        // turnNumber마다 최종 확정된 시도만 모아서(pickFinalAttempts) 그 위에서 충족 여부를 합친다.
        const finalAttempts = pickFinalAttempts([...session.sessionTurns, turn])
        const everMetItems = new Set(
          finalAttempts.flatMap((t) => t.evaluation?.metItems ?? []).filter((m) => m.met).map((m) => m.item)
        )
        allCriteriaMet = rubric.criteria.filter((c) => c.required).every((c) => everMetItems.has(c.item))

        completed = allCriteriaMet || turnNumber >= MAX_TURNS
        if (completed) {
          const completedAt = new Date()
          await prisma.trainingSession.update({
            where: { id: session.id },
            data: { status: 'completed', completedAt },
          })
          // 리포트 화면의 "총 훈련 시간" — 예전엔 "18분"으로 고정돼있던 값을 실제 시작~완료 시각 차이로 계산.
          durationMinutes = Math.max(1, Math.round((completedAt - session.startedAt) / 60000))
        } else {
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
      }
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
      durationMinutes,
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
