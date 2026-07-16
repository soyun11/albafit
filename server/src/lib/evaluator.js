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
기준을 다 충족하는 개선된 답변 예시를 하나 제시한다.

채점 기준마다 딸려있는 "좋은 예/나쁜 예"는 취지를 보여주는 참고용 예시일 뿐, 답변이 그 문장만큼
길거나 구체적이어야 met: true가 되는 건 아니다. 답변이 짧아도 손님의 직전 발화(맥락)를 참고했을 때
그 기준이 요구하는 행동을 실제로 했다고 볼 수 있으면 met: true로 판단한다.
예: 손님이 "왜 이렇게 늦어요?"라고 물은 직후 알바가 "죄송합니다"라고만 답해도, 그 대화 맥락에서는
지연에 대한 사과를 한 것이므로 met: true다. "예시 문장만큼 자세하지 않다"는 이유만으로 met: false를
주지 않는다 — 그 기준의 핵심 행동(사과했는지, 시간을 안내했는지 등) 자체가 있었는지만 본다.`

/**
 * @param {{ criteria: Array<{item: string, required: boolean, good_example: string, bad_example: string}>, customerMessage: string, staffAnswer: string, previouslyMetItems?: string[] }} params
 * @returns {Promise<{ metItems: Array<{item: string, met: boolean}>, missingCriteria: string[], feedback: string, improvedAnswer: string, passed: boolean }>}
 */
export async function evaluateTurn({ criteria, customerMessage, staffAnswer, previouslyMetItems = [] }) {
  const previouslyMetSet = new Set(previouslyMetItems)
  // 재입력(같은 손님 질문에 다시 답하는 것) 시 이전 시도에서 이미 충족한 항목을 다시 미충족으로
  // 판단하지 않도록 프롬프트에 명시한다 — 아래에서 LLM 응답을 그대로 믿지 않고 코드로도 강제한다.
  const previouslyMetText =
    previouslyMetItems.length > 0
      ? `\n\n아래 항목은 같은 손님 질문에 대한 이전 시도(재입력 전)에서 이미 충족한 것으로 확인됐다. 이번 답변에서 다시 언급되지 않았더라도 met: false로 판단하지 말고 met: true로 표시해라. 나머지 기준만 이번 답변 기준으로 새로 채점해라:\n${previouslyMetItems.map((item) => `- ${item}`).join('\n')}`
      : ''

  const prompt = `${SYSTEM_PROMPT}

평가 기준:
${criteria.map((c) => `- [${c.required ? '필수' : '선택'}] ${c.item} (좋은 예: ${c.good_example} / 나쁜 예: ${c.bad_example})`).join('\n')}${previouslyMetText}

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

  // Gemini가 met_items[].item에 프롬프트의 "[필수]/[선택] " 표시까지 그대로 echo해서 돌려줄 때가
  // 있다(직접 확인함) — 그러면 아래 missingCriteria가 criteria의 순수 item 텍스트와 정확히 안
  // 맞아떨어져서, 실제로 충족한 기준이 미충족으로 잘못 계산된다. 여기서 접두어를 벗겨 정규화한다.
  const stripLabelPrefix = (text) => text.replace(/^\[(필수|선택)\]\s*/, '')

  // 이전 시도에서 이미 충족한 항목은 LLM 판단과 무관하게 met:true로 강제 유지한다 —
  // missingCriteria를 LLM이 아니라 여기서 직접 계산하는 아래 원칙과 같은 방어막.
  const metItems = parsed.met_items
    .map((m) => ({ ...m, item: stripLabelPrefix(m.item) }))
    .map((m) => (previouslyMetSet.has(m.item) ? { ...m, met: true } : m))
  for (const item of previouslyMetItems) {
    if (!metItems.find((m) => m.item === item)) metItems.push({ item, met: true })
  }

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
