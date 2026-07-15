// 업종마다 실전 상황 3개씩 고정. type은 손님 에이전트(customerAgent.js)가 페르소나를 찾는 키라서
// 업종을 통틀어 겹치면 안 된다. 업종이 store.industry에 없거나 목록 밖 값이면 cafe로 대체한다.
// stores.js(매장용)와 guest.js(비회원 체험용) 둘 다 이 목록을 쓴다.
//
// situation — 이 시나리오가 정확히 "대화의 어느 순간"인지 설명하는 한 줄. rubric.js의 generateRubric()이
// 이 문장을 프롬프트에 같이 넣어서, 매장 규정 전체(인사말·포장확인·퇴점인사 등 주문 처음부터 끝까지의
// 규칙)를 이 순간과 무관하게 다 채점 기준으로 넣지 않고 실제 이 상황에서 나올 수 있는 것만 뽑게 한다.
// customerAgent.js의 SCENARIOS 맵에도 같은 문장이 있다(손님 대사를 만들 때 씀) — 두 곳이 어긋나지
// 않게 여기 문장을 그대로 복사해서 쓴다.
export const INDUSTRY_SCENARIOS = {
  cafe: [
    { type: 'delay', title: '음료 지연', situation: '카페에서 음료를 주문하고 오래 기다리고 있는 상황' },
    { type: 'out_of_stock', title: '품절 메뉴', situation: '주문하려는 메뉴의 재료가 품절이라는 안내를 받는 상황' },
    { type: 'rule_violation', title: '매장 규칙 위반 손님', situation: '매장 좌석·전원 이용시간 같은 매장 규칙을 안내받는 상황' },
  ],
  convenience: [
    { type: 'stockout', title: '품절 상품', situation: '편의점에서 사려는 상품이 품절인 상황' },
    { type: 'age_check', title: '미성년자 확인', situation: '나이 확인이 필요한 상품(담배·주류)을 사려는 상황' },
    { type: 'payment_issue', title: '결제·포인트 실수', situation: '결제나 포인트 적립에 문제가 생긴 상황' },
  ],
  restaurant: [
    { type: 'wait_time', title: '웨이팅 안내', situation: '음식점에 왔는데 자리가 없어 대기해야 하는 상황' },
    { type: 'menu_out', title: '재료 소진', situation: '주문하려는 메뉴의 재료가 다 떨어진 상황' },
    { type: 'complaint', title: '맛·이물질 컴플레인', situation: '음식 맛이나 이물질 관련 컴플레인을 하는 상황' },
  ],
  mart: [
    { type: 'price_mismatch', title: '가격표 오류', situation: '진열된 가격표와 실제 계산 금액이 다른 상황' },
    { type: 'item_location', title: '상품 위치 문의', situation: '찾는 상품이 어디 있는지 몰라 묻는 상황' },
    { type: 'return_exchange', title: '반품·교환', situation: '구매한 상품을 반품하거나 교환하려는 상황' },
  ],
  pcroom: [
    { type: 'seat_time', title: '좌석 이용시간', situation: '좌석·부스 이용 가능 시간을 문의하는 상황' },
    { type: 'equipment_issue', title: '장비 문제', situation: 'PC나 장비에 문제가 생겨 도움을 요청하는 상황' },
    { type: 'payment_dispute', title: '요금 계산 문의', situation: '이용 요금 계산이 맞는지 의문을 제기하는 상황' },
  ],
  beauty: [
    { type: 'appointment_delay', title: '예약 지연', situation: '예약한 시간보다 시술이 늦어지는 상황' },
    { type: 'service_change', title: '시술 변경 요청', situation: '예약한 시술 내용을 바꾸고 싶어하는 상황' },
    { type: 'price_dispute', title: '가격 안내 미흡', situation: '시술 가격 안내가 미리 충분히 안 된 상황' },
  ],
}
