import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { getCustomerReply, getOpeningLine } from '../lib/customerAgent.js'
import { evaluateTurn } from '../lib/evaluator.js'

const router = Router()

// 오늘은 시나리오 하나당 이 턴 수를 채우면 훈련 종료로 본다. 프론트 mock(TrainingSession.jsx)의
// "오프닝 + 2턴" 구조와 맞춘 값이라, 나중에 시나리오별로 다르게 하고 싶으면 이 상수를 분기하면 된다.
const MAX_TURNS = 3

// ============================================================
// 훈련 세션 시작 — POST /api/sessions
// 승인된 루브릭이 있는 시나리오에서만 시작할 수 있다("AI는 생성, 사장님은 승인" 게이트).
// ============================================================
router.post('/', requireAuth, async (req, res) => {
  const { scenarioType, staffLabel } = req.body ?? {}

  if (!req.user.storeId) {
    return res.status(400).json({ error: 'no store linked to this account' })
  }
  if (typeof scenarioType !== 'string') {
    return res.status(400).json({ error: 'scenarioType is required' })
  }

  try {
    const scenario = await prisma.scenario.findFirst({
      where: { storeId: req.user.storeId, type: scenarioType },
    })
    if (!scenario) {
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
      },
    })

    return res.status(201).json({
      session,
      scenario: { type: scenario.type, title: scenario.title },
      rubric: { id: rubric.id, criteria: rubric.criteria },
      openingLine: getOpeningLine(scenario.type),
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
      include: { scenario: true, sessionTurns: { orderBy: { turnNumber: 'asc' } } },
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

    const evaluation = await evaluateTurn({ criteria: rubric.criteria, customerMessage, staffAnswer })

    const turnNumber = session.sessionTurns.length + 1
    const turn = await prisma.sessionTurn.create({
      data: {
        sessionId: session.id,
        turnNumber,
        customerMessage,
        staffAnswer,
        evaluation,
        passed: evaluation.passed,
      },
    })

    const completed = turnNumber >= MAX_TURNS
    let nextCustomerMessage = null
    let durationMinutes = null

    if (completed) {
      const completedAt = new Date()
      await prisma.trainingSession.update({
        where: { id: session.id },
        data: { status: 'completed', completedAt },
      })
      // 리포트 화면의 "총 훈련 시간" — 예전엔 "18분"으로 고정돼있던 값을 실제 시작~완료 시각 차이로 계산.
      durationMinutes = Math.max(1, Math.round((completedAt - session.startedAt) / 60000))
    } else {
      // 지금까지의 대화(과거 턴 전부 + 이번 턴)를 히스토리로 넘겨서 다음 손님 발화를 만든다.
      const history = session.sessionTurns.flatMap((t) => [
        { sender: 'customer', text: t.customerMessage },
        { sender: 'staff', text: t.staffAnswer },
      ])
      history.push({ sender: 'customer', text: customerMessage }, { sender: 'staff', text: staffAnswer })

      nextCustomerMessage = await getCustomerReply({
        scenarioType: session.scenario.type,
        criteria: rubric.criteria,
        history,
      })
    }

    return res.status(201).json({ turn, evaluation, nextCustomerMessage, completed, durationMinutes })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'failed to submit turn' })
  }
})

// ============================================================
// 세션 조회 — GET /api/sessions/:id (리포트 화면용)
// ============================================================
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const session = await prisma.trainingSession.findUnique({
      where: { id: req.params.id },
      include: { scenario: true, sessionTurns: { orderBy: { turnNumber: 'asc' } } },
    })
    if (!session || session.storeId !== req.user.storeId) {
      return res.status(404).json({ error: 'session not found' })
    }
    return res.json(session)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'failed to fetch session' })
  }
})

export default router
