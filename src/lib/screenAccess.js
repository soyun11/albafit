// 사장님 전용 / 알바 전용 화면. 여기 없는 화면(랜딩, 로그인, 체험하기 등)은 역할·로그인 여부와
// 무관하게 항상 허용한다.
const OWNER_SCREENS = new Set(['industry', 'rules', 'rubric', 'rubricManage', 'invite', 'dashboard', 'calibration', 'correctionHistory'])
const STAFF_SCREENS = new Set(['scenario', 'training', 'myProgress'])
// 역할은 안 가리지만 로그인은 해야 하는 화면 — changePassword는 계정 설정, feedback은 알바가 자기
// 결과를 보는 것과 사장님이 리포트에서 남의 결과를 보는 것 둘 다에 쓰여서 특정 역할 전용이 아니다.
const AUTH_ONLY_SCREENS = new Set(['changePassword', 'feedback'])

// 이 화면에 지금 로그인 상태(user)로 들어가도 되는지. Home.jsx(전체 화면 목록 카탈로그)처럼
// 역할 체크 없이 아무 화면으로나 setScreen을 부르는 경로가 있었던 게 이 함수가 필요한 이유다 —
// AppNav는 역할별로 링크 자체를 안 보여주지만, 그건 "권한 없는 화면으로 가는 버튼을 안 보여줄
// 뿐"이라 실제로 그 화면을 렌더링하기 직전에 한 번 더 걸러야 다른 진입 경로가 생겨도 안전하다.
export function isScreenAllowed(screen, user) {
  // 로그인 상태면 마케팅 랜딩 페이지는 유효한 화면이 아니다 — landingScreenFor(user)로 대체된다
  // (docs/home-navigation-fix.md). goHome()/새로고침 복원 effect가 여전히 'landing'을 가리켜도
  // 여기서 한 번에 걸러지므로 그 호출부들은 손대지 않는다.
  if (screen === 'landing') return !user
  if (OWNER_SCREENS.has(screen)) return user?.role === 'owner'
  if (STAFF_SCREENS.has(screen)) return user?.role === 'staff'
  if (AUTH_ONLY_SCREENS.has(screen)) return Boolean(user)
  return true
}

// 로그인 직후/새로고침 복원 직후, 그리고 위 가드에 막혔을 때 어느 화면으로 보낼지 역할·매장 보유
// 여부로 결정한다.
export function landingScreenFor(user) {
  if (!user) return 'login'
  if (user.role === 'owner') return user.storeId ? 'dashboard' : 'industry'
  return 'scenario'
}
