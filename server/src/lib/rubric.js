import gemini from './gemini.js'

// docs/db-schema.md의 rubrics.criteria 컬럼 형식과 맞춘 스키마.
// responseMimeType + responseSchema로 이 형태를 강제해서, 텍스트로 JSON 흉내내게 하고 파싱하는 것보다 안전하게 받는다.
const RUBRIC_SCHEMA = {
  type: 'object',
  properties: {
    criteria: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item: { type: 'string' },
          required: { type: 'boolean' },
          good_example: { type: 'string' },
          bad_example: { type: 'string' },
        },
        required: ['item', 'required', 'good_example', 'bad_example'],
      },
    },
  },
  required: ['criteria'],
}

const SYSTEM_PROMPT = `너는 매장 응대 교육 서비스의 평가 기준 설계자다.
사장님이 입력한 매장 규정 원문을 읽고, 알바의 답변을 채점할 수 있는 평가 기준(체크리스트)으로 쪼갠다.
각 항목마다 반드시 지켜야 하는 필수 항목인지, 있으면 좋은 선택 항목인지 구분하고, 좋은 답변 예시와 나쁜 답변 예시를 하나씩 포함한다.
규정 원문에 없는 내용은 지어내지 않는다. 규정이 모호하거나 너무 짧으면 무리해서 항목 수를 채우지 말고, 실제로 규정에서 뽑아낼 수 있는 만큼만 만든다.`

/**
 * @param {{ scenarioType: string, scenarioTitle: string, rawRulesText: string }} params
 * @returns {Promise<Array<{item: string, required: boolean, good_example: string, bad_example: string}>>}
 */
export async function generateRubric({ scenarioType, scenarioTitle, rawRulesText }) {
  const prompt = `${SYSTEM_PROMPT}

매장 규정 원문:
"""
${rawRulesText}
"""

이 규정을 바탕으로 아래 시나리오에서 알바의 답변을 채점할 평가 기준을 만들어라.
시나리오 종류: ${scenarioType}
시나리오 제목: ${scenarioTitle}`

  const response = await gemini.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: RUBRIC_SCHEMA,
    },
  })

  const parsed = JSON.parse(response.text)
  return parsed.criteria
}
