import openai from './openai.js'

// evaluator.js가 겪은 것과 같은 문제(Gemini가 met_items[].item에 "[필수]/[선택] " 접두어를
// echo해서 돌려줌) — OpenAI도 같은 프롬프트 구조를 받으므로 방어적으로 동일하게 정규화한다.
const stripLabelPrefix = (text) => text.replace(/^\[(필수|선택)\]\s*/, '')

// 한쪽 모델의 met_items에 해당 item이 아예 없으면 met: false로 본다 — evaluator.js의
// missingCriteria 계산("찾지 못하면 미충족")과 같은 원칙.
function findMetValue(metItems, item) {
  return metItems.find((m) => stripLabelPrefix(m.item) === item)?.met ?? false
}

/**
 * 두 모델(A/B)의 met_items를 루브릭 criteria 기준으로 항목별 비교한다. 어느 쪽 LLM 출력도
 * 그대로 신뢰하지 않고, 일치 여부 판단은 이 함수(코드)가 결정론적으로 한다.
 * @param {Array<{item: string}>} criteria
 * @param {Array<{item: string, met: boolean}>} metItemsA
 * @param {Array<{item: string, met: boolean}>} metItemsB
 * @returns {Array<{item: string, metA: boolean, metB: boolean, mismatch: boolean}>}
 */
export function compareMetItems(criteria, metItemsA, metItemsB) {
  return criteria.map((c) => {
    const metA = findMetValue(metItemsA, c.item)
    const metB = findMetValue(metItemsB, c.item)
    return { item: c.item, metA, metB, mismatch: metA !== metB }
  })
}

/** @param {ReturnType<typeof compareMetItems>} comparison */
export function findMismatches(comparison) {
  return comparison.filter((row) => row.mismatch)
}

const CROSS_CHECK_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'cross_check_evaluation',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        met_items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              item: { type: 'string' },
              met: { type: 'boolean' },
            },
            required: ['item', 'met'],
            additionalProperties: false,
          },
        },
      },
      required: ['met_items'],
      additionalProperties: false,
    },
  },
}

const SYSTEM_PROMPT = `너는 매장 응대 교육 서비스의 채점관이다.
주어진 평가 기준(루브릭) 목록만 근거로 알바의 답변을 채점한다. 루브릭에 없는 기준으로 판단하지 않는다.
각 기준 항목마다 이번 답변이 그 기준을 충족했는지(met: true/false)만 판단한다.`

// 평가 에이전트(Gemini)의 채점을 다른 벤더(OpenAI gpt-4o-mini)로 한 번 더 채점한다 —
// 정답을 정하기 위해서가 아니라 "두 독립된 모델이 갈리는 항목"을 신호로 뽑아내기 위해서다
// (docs/evaluation-cross-check.md 참고). feedback/improved_answer는 비교에 안 쓰이므로
// evaluator.js와 달리 met_items만 요청한다.
export async function crossCheckEvaluateTurn({ criteria, customerMessage, staffAnswer }) {
  const criteriaText = criteria
    .map((c) => `- [${c.required ? '필수' : '선택'}] ${c.item} (좋은 예: ${c.good_example} / 나쁜 예: ${c.bad_example})`)
    .join('\n')

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `평가 기준:\n${criteriaText}\n\n손님: "${customerMessage}"\n알바 답변: "${staffAnswer}"`,
      },
    ],
    response_format: CROSS_CHECK_RESPONSE_FORMAT,
  })

  return JSON.parse(response.choices[0].message.content).met_items
}

// 참고 로그일 뿐 판정에 개입하지 않는다 — 불일치가 있으면 나중에 눈에 띄도록 warn으로,
// 없으면 log로만 남긴다 (docs/evaluation-cross-check.md "결정" 표).
export function logCrossCheckResult({ turnId, comparison, mismatches }) {
  if (mismatches.length === 0) {
    console.log(`[cross-check] turn ${turnId}: 일치 (${comparison.length}개 항목 모두 동일)`)
    return
  }
  console.warn(`[cross-check] turn ${turnId}: 불일치 ${mismatches.length}건`, mismatches)
}

/**
 * 라우트에서 fire-and-forget으로 호출하는 진입점 — 반환값을 기다리지 않고 호출해야 한다
 * (턴 응답 지연 금지). 실패는 호출부에서 .catch로 격리한다.
 */
export async function runCrossCheck({ turnId, criteria, customerMessage, staffAnswer, geminiMetItems }) {
  const openaiMetItems = await crossCheckEvaluateTurn({ criteria, customerMessage, staffAnswer })
  const comparison = compareMetItems(criteria, geminiMetItems, openaiMetItems)
  const mismatches = findMismatches(comparison)
  logCrossCheckResult({ turnId, comparison, mismatches })
}
