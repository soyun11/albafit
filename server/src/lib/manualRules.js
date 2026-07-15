import gemini from './gemini.js'

// 사장님이 자유롭게 적은 매장 매뉴얼 원문을, 규칙 카드 여러 개(제목+내용)로 나누기 위한 스키마.
// generateRubric과 같은 이유로 JSON 스키마를 강제한다 — 텍스트 파싱보다 안전하게 구조화된 배열을 받는다.
const MANUAL_RULES_SCHEMA = {
  type: 'object',
  properties: {
    rules: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['title', 'content'],
      },
    },
  },
  required: ['rules'],
}

const SYSTEM_PROMPT = `너는 매장 운영 매뉴얼을 정리하는 도우미다.
사장님이 자유롭게 적은 매장 매뉴얼·규정 원문을 읽고, 서로 다른 규칙마다 하나의 항목으로 나눈다.
각 항목은 내용을 잘 나타내는 짧은 제목(title)과, 원문 내용을 그대로 살린 content로 구성한다.
원문에 없는 내용은 지어내지 않는다. 문장 하나가 사실상 한 가지 규칙이면 억지로 더 쪼개지 않는다.`

/**
 * @param {{ manualText: string }} params
 * @returns {Promise<Array<{title: string, content: string}>>}
 */
export async function splitManualRules({ manualText }) {
  const prompt = `${SYSTEM_PROMPT}

매장 매뉴얼 원문:
"""
${manualText}
"""`

  const response = await gemini.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: MANUAL_RULES_SCHEMA,
    },
  })

  const parsed = JSON.parse(response.text)
  return parsed.rules
}
