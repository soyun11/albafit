// Gemini/OpenAI가 responseSchema를 강제해도 100% JSON만 돌려준다는 보장은 없다 — 가끔 코드펜스로
// 감싸서 오거나(```json ... ```), 아주 드물게 JSON이 아닌 텍스트를 섞어 보낸다. evaluator.js·
// rubric.js·scenarioProposer.js가 각자 JSON.parse(response.text)를 방어 없이 그대로 호출하던 걸
// 이 함수 하나로 모아서, 실패 시에도 원인을 알 수 있는 에러를 던지게 한다(크래시 자체를 막지는
// 않지만, 무슨 응답 때문에 실패했는지 로그에 남길 수 있게 됨).
function stripCodeFence(text) {
  const trimmed = text.trim()
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  return fenceMatch ? fenceMatch[1] : trimmed
}

export function parseAIJson(text) {
  const cleaned = stripCodeFence(text ?? '')
  try {
    return JSON.parse(cleaned)
  } catch (err) {
    throw new Error(`AI 응답을 JSON으로 파싱하지 못했습니다: ${err.message}`)
  }
}
