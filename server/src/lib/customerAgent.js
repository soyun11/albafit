import openai from './openai.js'
import { withRetry } from './retry.js'

// 시나리오 타입별로 바뀌지 않는 것만 남긴다: 오프닝 대사, 한 줄짜리 상황 설명.
// 손님의 실제 성격·반응 방식은 이 매장의 루브릭(criteria)을 보고 매번 동적으로 만든다 —
// 그래야 매장마다 다른 규칙이 손님 대사에도 반영되는 "매장 맞춤" 훈련이 된다.
const SCENARIOS = {
  delay: {
    opening: '아이스 아메리카노 시킨 지 좀 됐는데, 얼마나 더 걸릴까요?',
    situation: '카페에서 음료를 주문하고 오래 기다리고 있는 상황',
  },
  out_of_stock: {
    opening: '바닐라 라떼 하나 주세요.',
    situation: '주문하려는 메뉴의 재료가 품절이라는 안내를 받는 상황',
  },
  rule_violation: {
    opening: '저기 콘센트 좀 오래 써도 되죠? 노트북 작업 좀 하려고요.',
    situation: '매장 좌석·전원 이용시간 같은 매장 규칙을 안내받는 상황',
  },
  // 편의점
  stockout: {
    opening: '혹시 삼각김밥 있어요?',
    situation: '편의점에서 사려는 상품이 품절인 상황',
  },
  age_check: {
    opening: '여기 담배 한 갑 주세요.',
    situation: '나이 확인이 필요한 상품(담배·주류)을 사려는 상황',
  },
  payment_issue: {
    opening: '저 포인트 적립 안 해주셨는데요?',
    situation: '결제나 포인트 적립에 문제가 생긴 상황',
  },
  // 음식점 · 외식
  wait_time: {
    opening: '지금 들어가면 얼마나 기다려야 해요?',
    situation: '음식점에 왔는데 자리가 없어 대기해야 하는 상황',
  },
  menu_out: {
    opening: '여기 오늘의 메뉴 하나 주세요.',
    situation: '주문하려는 메뉴의 재료가 다 떨어진 상황',
  },
  complaint: {
    opening: '저기요, 이 음식에 이상한 게 들어있는데요?',
    situation: '음식 맛이나 이물질 관련 컴플레인을 하는 상황',
  },
  // 마트 · 유통
  price_mismatch: {
    opening: '여기 가격표엔 3000원이라고 써있는데 계산하니 5000원이 나왔어요.',
    situation: '진열된 가격표와 실제 계산 금액이 다른 상황',
  },
  item_location: {
    opening: '저기 혹시 세제는 어디 있어요?',
    situation: '찾는 상품이 어디 있는지 몰라 묻는 상황',
  },
  return_exchange: {
    opening: '이거 어제 샀는데 환불 되나요?',
    situation: '구매한 상품을 반품하거나 교환하려는 상황',
  },
  // PC방 · 오락실
  seat_time: {
    opening: '저 여기 몇 시간까지 쓸 수 있어요?',
    situation: '좌석·부스 이용 가능 시간을 문의하는 상황',
  },
  equipment_issue: {
    opening: '여기 마우스가 잘 안 눌리는데요.',
    situation: 'PC나 장비에 문제가 생겨 도움을 요청하는 상황',
  },
  payment_dispute: {
    opening: '제가 두 시간만 썼는데 왜 세 시간 요금이 나왔어요?',
    situation: '이용 요금 계산이 맞는지 의문을 제기하는 상황',
  },
  // 뷰티 · 헤어
  appointment_delay: {
    opening: '저 3시에 예약했는데 왜 아직도 기다려야 해요?',
    situation: '예약한 시간보다 시술이 늦어지는 상황',
  },
  service_change: {
    opening: '생각해보니까 커트 말고 펌으로 하고 싶은데 가능해요?',
    situation: '예약한 시술 내용을 바꾸고 싶어하는 상황',
  },
  price_dispute: {
    opening: '이거 얼마 나와요? 처음에 말한 가격이랑 다른 것 같은데요.',
    situation: '시술 가격 안내가 미리 충분히 안 된 상황',
  },
}

export function getOpeningLine(scenarioType) {
  return (SCENARIOS[scenarioType] ?? SCENARIOS.delay).opening
}

// situation을 직접 받는다(예전엔 SCENARIOS[scenarioType]에서 찾았음) — 매장이 AI로 제안받은
// 시나리오는 SCENARIOS 맵에 없는 자유 텍스트 situation을 쓰므로, 조회 대신 파라미터로 분리했다.
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

/**
 * @param {{ scenarioType: string, criteria: Array<{item: string, required: boolean}>, history: Array<{sender: 'customer'|'staff', text: string}> }} params
 * @returns {Promise<string>} 손님의 다음 발화
 */
export async function getCustomerReply({ scenarioType, criteria, history }) {
  const { situation } = SCENARIOS[scenarioType] ?? SCENARIOS.delay
  return callCustomerAgent({ situation, criteria, history })
}

// 아래 두 함수는 guest.js(체험하기, 고정 SCENARIOS 맵)는 안 쓰고, 실제 매장의 AI 제안 시나리오
// (Scenario.persona = { situation, opening })에서만 쓴다.

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
