import gemini from './gemini.js'
import { parseAIJson } from './aiJson.js'
import { withRetry } from './retry.js'

// rubric.js의 RUBRIC_SCHEMA와 같은 목적 — responseSchema로 형태를 강제해서 텍스트 파싱 사고를 막는다.
const SCENARIOS_SCHEMA = {
  type: 'object',
  properties: {
    scenarios: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          situation: { type: 'string' },
          opening: { type: 'string' },
        },
        required: ['title', 'situation', 'opening'],
      },
    },
  },
  required: ['scenarios'],
}

const SYSTEM_PROMPT = `너는 매장 응대 교육 서비스의 시나리오 설계자다.
사장님이 입력한 매장 규정 원문을 읽고, 알바가 실전처럼 연습할 만한 손님 응대 상황을 서로 다르게 여러 개 뽑는다.
규정에 없는 상황을 억지로 지어내지 않는다. 다만 업종에서 통상적으로 있을 법한 상황 설정(예: 카페면 주문·대기·포장 같은 기본 맥락)은 허용한다.
각 상황마다 다음을 만든다.
- title: 상황을 짧게 요약한 제목
- situation: 지금이 정확히 어떤 순간인지 한 줄 설명 (알바 입장에서 무슨 상황에 놓여있는지)
- opening: 손님이 이 상황에서 처음 건넬 만한 대사 한 줄`

/**
 * @param {{ rawRulesText: string, industry: string }} params
 * @returns {Promise<Array<{title: string, situation: string, opening: string}>>}
 */
export async function proposeScenarios({ rawRulesText, industry }) {
  const prompt = `${SYSTEM_PROMPT}

업종: ${industry}
매장 규정 원문:
"""
${rawRulesText}
"""

이 규정을 바탕으로 실전 훈련에 쓸 만한 서로 다른 상황을 3~5개 뽑아라.`

  const response = await withRetry(() =>
    gemini.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: SCENARIOS_SCHEMA,
      },
    }),
  )

  const parsed = parseAIJson(response.text)
  const scenarios = parsed.scenarios ?? []

  if (scenarios.length === 0) {
    throw new Error('failed to propose any scenarios from the given rules')
  }

  // 폭주 방지 — 프롬프트로 3~5개를 요청하지만, 응답이 예상보다 많이 와도 여기서 상한을 강제한다.
  return scenarios.slice(0, 6)
}
