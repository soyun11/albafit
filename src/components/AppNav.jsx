import './AppNav.css'

const OWNER_LINKS = [
  { key: 'dashboard', label: '대시보드' },
  { key: 'rubricManage', label: '기준 관리' },
  { key: 'reports', label: '리포트' },
  { key: 'invite', label: '알바 관리' },
]

const STAFF_LINKS = [
  { key: 'scenario', label: '시나리오 선택' },
  { key: 'myProgress', label: '내 현황' },
]

// 로그인 전(체험하기 등)에는 owner/staff 링크 대신 로그인·회원가입 버튼만 보여준다.
const LINK_SETS = { owner: OWNER_LINKS, staff: STAFF_LINKS }

// 로그인한 사장님/알바 화면 + 로그인 전 화면(체험하기, 온보딩 중)까지 전체가 공유하는 상단바.
// 화면마다 nav를 따로 만들다 보니 대시보드에서 기준관리·리포트로 못 넘어가는 등 이동 경로가
// 제각각이었어서 하나로 통일했다. role이 'owner'/'staff'가 아니면(로그인 전) 계정 메뉴 대신
// 로그인/회원가입 버튼을 보여준다.
// disabledKeys — 사장님 온보딩 중(매장을 아직 안 만든 상태)처럼, 링크는 보여주되 아직 눌러도
// 의미가 없는 항목을 회색으로 비활성화할 때 쓴다.
function AppNav({ role, current, onNavigate, onChangePassword, onLogout, children, disabledKeys = [] }) {
  const links = LINK_SETS[role] ?? []
  const isLoggedIn = role === 'owner' || role === 'staff'

  return (
    <nav className="app-nav">
      <div className="app-nav-left">
        <button type="button" className="app-nav-logo mono" onClick={() => onNavigate('home')}>
          albafit
        </button>
        <div className="app-nav-links">
          {links.map((link) => {
            const isDisabled = disabledKeys.includes(link.key)
            return (
              <button
                key={link.key}
                type="button"
                className={`app-nav-link ${current === link.key ? 'active' : ''}`}
                onClick={() => onNavigate(link.key)}
                disabled={isDisabled}
                aria-current={current === link.key ? 'page' : undefined}
              >
                {link.label}
                {/* title 툴팁은 마우스 호버에만 반응해 모바일(터치)에서는 안 보인다 — 항상 보이는
                    캡션으로 대체한다. */}
                {isDisabled && <span className="app-nav-link-hint">매장 설정을 마치면 이용할 수 있어요</span>}
              </button>
            )
          })}
        </div>
      </div>
      <div className="app-nav-right">
        {children}
        {isLoggedIn ? (
          <>
            <button type="button" className="app-nav-link" onClick={onChangePassword}>
              계정
            </button>
            <button type="button" className="app-nav-link" onClick={onLogout}>
              로그아웃
            </button>
          </>
        ) : (
          <>
            <button type="button" className="app-nav-link" onClick={() => onNavigate('login')}>
              로그인
            </button>
            <button type="button" className="app-nav-link" onClick={() => onNavigate('signup')}>
              회원가입
            </button>
          </>
        )}
      </div>
    </nav>
  )
}

export default AppNav
