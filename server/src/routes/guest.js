import { Router } from 'express'
import { generateRubric } from '../lib/rubric.js'
import { getCustomerReply, getOpeningLine } from '../lib/customerAgent.js'
import { evaluateTurn } from '../lib/evaluator.js'
import { INDUSTRY_SCENARIOS } from '../lib/industryScenarios.js'

// 로그인 없이 매장 연결 없이 써보는 "체험하기" 전용 라우트. 인증도, DB 저장도 없다 —
// generateRubric/getCustomerReply/evaluateTurn이 전부 DB에 의존하지 않는 순수 함수라 그대로 재사용할
// 수 있다. 대화 상태는 전부 클라이언트(브라우저 메모리)가 들고 있다가 매 요청에 실어 보낸다.
//
// 주의: 인증 없이 유료 LLM(OpenAI+Gemini)을 직접 호출하는 엔드포인트라 어뷰징 시 비용이 샐 수 있다.
// 지금은 4주 챌린지 데모 범위라 그대로 두지만, 실제로 공개 배포하기 전엔 IP당 요청 제한 같은 최소한의
// 방어를 반드시 추가해야 한다.

const router = Router()
const MAX_TURNS = 3

function findScenario(scenarioType) {
  for (const scenarios of Object.values(INDUSTRY_SCENARIOS)) {
    const found = scenarios.find((s) => s.type === scenarioType)
    if (found) return found
  }
  return null
}

function findScenarioTitle(scenarioType) {
  return findScenario(scenarioType)?.title ?? null
}

// ============================================================
// 손님 오프닝 대사 — GET /api/guest/opening?scenarioType=xxx (LLM 호출 없음, 즉시 응답)
// ============================================================
router.get('/opening', (req, res) => {
  const { scenarioType } = req.query
  if (typeof scenarioType !== 'string' || !findScenarioTitle(scenarioType)) {
    return res.status(400).json({ error: 'unknown scenarioType' })
  }
  return res.json({ openingLine: getOpeningLine(scenarioType) })
})

// ============================================================
// 규칙 → 루브릭 변환 체험 — POST /api/guest/rubric
// ============================================================
router.post('/rubric', async (req, res) => {
  const { scenarioType, rawRulesText } = req.body ?? {}

  const scenarioTitle = typeof scenarioType === 'string' ? findScenarioTitle(scenarioType) : null
  if (!scenarioTitle) {
    return res.status(400).json({ error: 'unknown scenarioType' })
  }
  if (typeof rawRulesText !== 'string' || rawRulesText.trim().length === 0) {
    return res.status(400).json({ error: 'rawRulesText is required' })
  }
  if (rawRulesText.length > 2000) {
    return res.status(400).json({ error: 'rawRulesText must be 2000 characters or fewer' })
  }

  try {
    const criteria = await generateRubric({
      scenarioType,
      scenarioTitle,
      situation: findScenario(scenarioType)?.situation,
      rawRulesText,
    })
    return res.json({ criteria })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'failed to generate rubric' })
  }
})

// ============================================================
// 대화 체험 한 턴 — POST /api/guest/turn
// body: { scenarioType, criteria, messages, staffAnswer }
// messages는 지금까지의 대화([{sender:'customer'|'staff', text}, ...]), 클라이언트가 계속 들고 있다가 보낸다.
// ============================================================
router.post('/turn', async (req, res) => {
  const { scenarioType, criteria, messages, staffAnswer } = req.body ?? {}

  if (typeof scenarioType !== 'string' || !findScenarioTitle(scenarioType)) {
    return res.status(400).json({ error: 'unknown scenarioType' })
  }
  if (!Array.isArray(criteria) || criteria.length === 0) {
    return res.status(400).json({ error: 'criteria is required' })
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages is required' })
  }
  if (typeof staffAnswer !== 'string' || staffAnswer.trim().length === 0) {
    return res.status(400).json({ error: 'staffAnswer is required' })
  }

  const lastMessage = messages[messages.length - 1]
  if (lastMessage?.sender !== 'customer') {
    return res.status(400).json({ error: 'the last message must be from the customer' })
  }

  try {
    const evaluation = await evaluateTurn({
      criteria,
      customerMessage: lastMessage.text,
      staffAnswer,
    })

    // 지금까지 몇 턴 주고받았는지는 messages 안의 'staff' 메시지 개수로 센다(체험판이라 DB에 turnNumber를 안 둠).
    const turnNumber = messages.filter((m) => m.sender === 'staff').length + 1
    const completed = turnNumber >= MAX_TURNS

    let nextCustomerMessage = null
    if (!completed) {
      const history = [...messages, { sender: 'staff', text: staffAnswer }]
      nextCustomerMessage = await getCustomerReply({ scenarioType, criteria, history })
    }

    return res.json({ evaluation, nextCustomerMessage, completed })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'failed to process turn' })
  }
})

export default router
