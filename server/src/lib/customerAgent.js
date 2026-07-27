import openai from './openai.js'
import { withRetry } from './retry.js'

function buildSystemPrompt({ situation, criteria }) {
  const criteriaText = criteria
    .map((c) => `- ${c.item}${c.required ? ' (필수)' : ' (선택)'}`)
    .join('\n')

  return `너는 매장에 온 손님이다. 지금 상황: ${situation}.
이 매장은 알바를 아래 기준으로 평가한다. 네 대사가 자연스럽게 이 기준들을 하나씩 시험해보게 만들어라
(예: "얼마나 걸려요?"처럼 되묻거나, 알바가 안내를 안 해준 부분을 다시 캐묻는 식으로).
알바가 기준을 잘 지키는 답을 하면 누그러지고, 애매하거나 기준을 놓친 답을 하면 다시 캐묻거나 살짝 짜증을 낸다.
${criteriaText}

한두 문장의 짧고 자연스러운 구어체로만 답한다. 손님 대사만 말하고 상황 설명이나 지문은 쓰지 않는다.`
}

async function callCustomerAgent({ situation, criteria, history }) {
  const messages = [
    { role: 'system', content: buildSystemPrompt({ situation, criteria }) },
    ...history.map((turn) => ({
      role: turn.sender === 'staff' ? 'user' : 'assistant',
      content: turn.text,
    })),
  ]

  const response = await withRetry(() =>
    openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
    }),
  )

  return response.choices[0].message.content
}

export function getOpeningLineForScenario(scenario) {
  return scenario.persona?.opening ?? ''
}

/**
 * @param {{ situation: string, criteria: Array<{item: string, required: boolean}>, history: Array<{sender: 'customer'|'staff', text: string}> }} params
 * @returns {Promise<string>} 손님의 다음 발화
 */
export async function getCustomerReplyForScenario({ situation, criteria, history }) {
  return callCustomerAgent({ situation, criteria, history })
}
