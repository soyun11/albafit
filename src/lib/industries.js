// IndustrySelect.jsx, ScenarioSelect.jsx, GuestTry.jsx가 공유하는 업종·시나리오 목록.
// 컴포넌트 파일에서 직접 export하면 Fast Refresh가 깨져서(oxlint 경고) 별도 파일로 뺐다.

export const INDUSTRIES = [
  { key: 'cafe', icon: '☕', label: '카페 · 디저트' },
  { key: 'convenience', icon: '🏪', label: '편의점' },
  { key: 'restaurant', icon: '🍽️', label: '음식점 · 외식' },
  { key: 'mart', icon: '🛒', label: '마트 · 유통' },
  { key: 'pcroom', icon: '🎮', label: 'PC방 · 오락실' },
  { key: 'beauty', icon: '💇', label: '뷰티 · 헤어' },
]

// key는 백엔드 Scenario.type과 동일한 값을 그대로 쓴다.
export const INDUSTRY_SCENARIOS = {
  cafe: [
    { key: 'delay', icon: '⏰', title: '음료 지연', desc: '사과 · 대기시간 안내 연습' },
    { key: 'out_of_stock', icon: '📦', title: '품절 메뉴', desc: '사과 · 대체 메뉴 안내 연습' },
    { key: 'rule_violation', icon: '🙅', title: '매장 규칙 위반 손님', desc: '규칙 안내 · 부드러운 대안 제시 연습' },
  ],
  convenience: [
    { key: 'stockout', icon: '📦', title: '품절 상품', desc: '품절 안내 · 대안 제시 연습' },
    { key: 'age_check', icon: '🪪', title: '미성년자 확인', desc: '신분증 확인 · 정중한 거절 연습' },
    { key: 'payment_issue', icon: '💳', title: '결제·포인트 실수', desc: '문제 확인 · 정정 안내 연습' },
  ],
  restaurant: [
    { key: 'wait_time', icon: '⏰', title: '웨이팅 안내', desc: '대기시간 안내 연습' },
    { key: 'menu_out', icon: '📦', title: '재료 소진', desc: '품절 안내 · 대체 메뉴 제안 연습' },
    { key: 'complaint', icon: '🙅', title: '맛·이물질 컴플레인', desc: '공감 · 대응 절차 안내 연습' },
  ],
  mart: [
    { key: 'price_mismatch', icon: '🏷️', title: '가격표 오류', desc: '확인 · 정중한 안내 연습' },
    { key: 'item_location', icon: '📍', title: '상품 위치 문의', desc: '위치 안내 연습' },
    { key: 'return_exchange', icon: '🔄', title: '반품·교환', desc: '절차 안내 연습' },
  ],
  pcroom: [
    { key: 'seat_time', icon: '⏰', title: '좌석 이용시간', desc: '이용시간 안내 연습' },
    { key: 'equipment_issue', icon: '🖥️', title: '장비 문제', desc: '문제 확인 · 대응 연습' },
    { key: 'payment_dispute', icon: '💳', title: '요금 계산 문의', desc: '요금 설명 연습' },
  ],
  beauty: [
    { key: 'appointment_delay', icon: '⏰', title: '예약 지연', desc: '사과 · 대기시간 안내 연습' },
    { key: 'service_change', icon: '✂️', title: '시술 변경 요청', desc: '가능 여부 안내 연습' },
    { key: 'price_dispute', icon: '💳', title: '가격 안내 미흡', desc: '가격 정정 안내 연습' },
  ],
}
