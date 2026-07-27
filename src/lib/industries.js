// IndustrySelect.jsx가 쓰는 업종 목록 (로그인한 매장의 훈련 화면은 ScenarioSelect.jsx가
// GET /api/stores/me/training-scenarios로 AI 제안·기본 시나리오를 받아온다. 체험하기는
// guestTourContent.js를 따로 쓴다 — docs/guest-tour-redesign.md).
// 컴포넌트 파일에서 직접 export하면 Fast Refresh가 깨져서(oxlint 경고) 별도 파일로 뺐다.

export const INDUSTRIES = [
  { key: 'cafe', icon: '☕', label: '카페 · 디저트' },
  { key: 'convenience', icon: '🏪', label: '편의점' },
  { key: 'restaurant', icon: '🍽️', label: '음식점 · 외식' },
  { key: 'mart', icon: '🛒', label: '마트 · 유통' },
  { key: 'pcroom', icon: '🎮', label: 'PC방 · 오락실' },
  { key: 'beauty', icon: '💇', label: '뷰티 · 헤어' },
]
