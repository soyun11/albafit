import gemini from './gemini.js'

// CLAUDE.md의 {충족여부, 빠진기준[], 피드백, 개선문장} 형식과 맞춘 스키마.
const EVALUATION_SCHEMA = {
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
      },
    },
    feedback: { type: 'string' },
    improved_answer: { type: 'string' },
  },
  required: ['met_items', 'feedback', 'improved_answer'],
}

const SYSTEM_PROMPT = `너는 매장 응대 교육 서비스의 채점관이다.
주어진 평가 기준(루브릭) 목록만 근거로 알바의 답변을 채점한다. 루브릭에 없는 기준으로 판단하지 않는다.
각 기준 항목마다 이번 답변이 그 기준을 충족했는지(met: true/false) 판단하고,
전체적으로 무엇이 좋았고 무엇을 고치면 좋을지 피드백을 한두 문장으로 쓰고,
기준을 다 충족하는 개선된 답변 예시를 하나 제시한다.`

/**
 * @param {{ criteria: Array<{item: string, required: boolean, good_example: string, bad_example: string}>, customerMessage: string, staffAnswer: string }} params
 * @returns {Promise<{ metItems: Array<{item: string, met: boolean}>, missingCriteria: string[], feedback: string, improvedAnswer: string, passed: boolean }>}
 */
export async function evaluateTurn({ criteria, customerMessage, staffAnswer }) {
  const prompt = `${SYSTEM_PROMPT}

평가 기준:
${criteria.map((c) => `- [${c.required ? '필수' : '선택'}] ${c.item} (좋은 예: ${c.good_example} / 나쁜 예: ${c.bad_example})`).join('\n')}

손님: "${customerMessage}"
알바 답변: "${staffAnswer}"`

  const response = await gemini.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: EVALUATION_SCHEMA,
    },
  })

  const parsed = JSON.parse(response.text)
  const metItems = parsed.met_items

  // required 항목을 전부 충족했는지는 LLM의 자기 판단이 아니라 여기서 직접 계산한다 —
  // 채점 기준(필수/선택 구분)은 이미 루브릭에 있으니 그걸 그대로 신뢰하는 게 더 일관적이다.
  const missingCriteria = criteria
    .filter((c) => c.required && !metItems.find((m) => m.item === c.item)?.met)
    .map((c) => c.item)

  return {
    metItems,
    missingCriteria,
    feedback: parsed.feedback,
    improvedAnswer: parsed.improved_answer,
    passed: missingCriteria.length === 0,
  }
}
