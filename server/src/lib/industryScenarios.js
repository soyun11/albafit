// 업종마다 실전 상황 3개씩 고정. type은 손님 에이전트(customerAgent.js)가 페르소나를 찾는 키라서
// 업종을 통틀어 겹치면 안 된다. 업종이 store.industry에 없거나 목록 밖 값이면 cafe로 대체한다.
// stores.js(매장용)와 guest.js(비회원 체험용) 둘 다 이 목록을 쓴다.
export const INDUSTRY_SCENARIOS = {
  cafe: [
    { type: 'delay', title: '음료 지연' },
    { type: 'out_of_stock', title: '품절 메뉴' },
    { type: 'rule_violation', title: '매장 규칙 위반 손님' },
  ],
  convenience: [
    { type: 'stockout', title: '품절 상품' },
    { type: 'age_check', title: '미성년자 확인' },
    { type: 'payment_issue', title: '결제·포인트 실수' },
  ],
  restaurant: [
    { type: 'wait_time', title: '웨이팅 안내' },
    { type: 'menu_out', title: '재료 소진' },
    { type: 'complaint', title: '맛·이물질 컴플레인' },
  ],
  mart: [
    { type: 'price_mismatch', title: '가격표 오류' },
    { type: 'item_location', title: '상품 위치 문의' },
    { type: 'return_exchange', title: '반품·교환' },
  ],
  pcroom: [
    { type: 'seat_time', title: '좌석 이용시간' },
    { type: 'equipment_issue', title: '장비 문제' },
    { type: 'payment_dispute', title: '요금 계산 문의' },
  ],
  beauty: [
    { type: 'appointment_delay', title: '예약 지연' },
    { type: 'service_change', title: '시술 변경 요청' },
    { type: 'price_dispute', title: '가격 안내 미흡' },
  ],
}
