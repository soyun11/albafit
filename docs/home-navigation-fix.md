# home-navigation-fix.md — 로그인 상태에서 "홈"이 랜딩 페이지로 가는 문제 수정

> `docs/rubric-reuse.md`와 같은 방식으로 기록한다. 근거: 사용자가 직접 화면을 써보다 지적한 UX 문제, 2026-07-22.

## 왜 고쳤나

albafit은 라우터 없는 SPA로, `src/App.jsx`의 `screen` state 문자열 하나로 어떤 화면을 보여줄지 정한다. 로그인한 사장님/알바가 로고를 클릭하거나 새로고침해도, 자기 대시보드/시나리오 화면이 아니라 마케팅용 랜딩 페이지(`LandingPage.jsx` — 홍보 카피 + 로그인 버튼 + "매장 없이 체험하기"만 있는 화면)로 가버려서 매번 "시작하기"를 다시 눌러야 했다.

코드를 추적해보니 `src/lib/screenAccess.js`에 로그인/역할 상태별로 진짜 홈 화면을 계산하는 `landingScreenFor(user)`가 이미 있고, 로그인 직후(`handleLoginSuccess`)·회원가입 직후(`handleSignupSuccess`)·"시작하기" 버튼(`handleStart`)은 전부 이 함수를 쓴다. 그런데 딱 두 군데만 이 함수를 안 쓰고 `'landing'`을 하드코딩했다:
- `goHome()`(`App.jsx:87-90`) — 로고 클릭(`AppNav`의 `onNavigate('home')` → `handleNavigate` → `goHome`)을 포함해 여러 화면의 "홈으로" 버튼이 이 함수를 쓴다.
- 새로고침 시 토큰으로 로그인 상태를 복원하는 `useEffect`(`App.jsx:75-85`) — `setUser(data.user)`만 하고 `screen`은 절대 안 바꿔서, 새로고침 후에도 초기값인 `'landing'`에 머문다.

`effectiveScreen = isScreenAllowed(screen, user) ? screen : landingScreenFor(user)`(`App.jsx:64`)가 "잘못된 화면이면 자동으로 걸러내는" 단일 관문 역할을 하도록 이미 설계돼 있는데(주석에 그 의도가 명시돼 있음), `isScreenAllowed`가 `'landing'`을 어떤 제한 집합에도 안 넣어서 항상 `true`를 반환한다 — 그래서 로그인 상태에서도 `'landing'`이 그대로 통과됐다. 의도된 분기가 아니라 일관성 누락(버그)이었다.

## 결정

| 논점 | 결정 | 이유 |
|---|---|---|
| 어디를 고치나 | `goHome()`이나 새로고침 복원 `useEffect`를 개별적으로 고치지 않고, **`isScreenAllowed`에 `'landing'` 판단 조건 하나만 추가** | `effectiveScreen`이 이미 "잘못된 화면을 자동으로 대체한다"는 단일 관문으로 설계돼 있다(주석에 명시). 이 한 곳만 고치면 `goHome`·복원 effect·앞으로 실수로 생길 다른 경로까지 전부 한 번에 안전해진다 — 여러 호출부를 일일이 찾아 고치는 것보다 견고하다. |
| 로그인 상태에서 랜딩을 다시 볼 방법 | **없음 — 로그아웃해야만 다시 보임** (사용자 확인) | 로그인한 다음부터 마케팅 카피를 다시 볼 이유가 없다고 판단. 별도의 "서비스 소개 보기" 진입점은 만들지 않는다(과설계 방지). |

## 다음 단계

1. ~~설계 문서화 (이 문서)~~ — 완료
2. `src/lib/screenAccess.js`의 `isScreenAllowed`에 `if (screen === 'landing') return !user` 추가
3. `src/lib/screenAccess.test.js`에 로그인/비로그인 각각의 `'landing'` 허용 여부 테스트 추가
4. `npm test`(루트) + `npm run lint` 통과 확인
5. 브라우저로 직접 확인: 사장님/알바 로그인 후 로고 클릭·새로고침이 각자의 실제 홈으로 가는지, 로그아웃 후에는 랜딩이 정상적으로 보이는지, 로그인 전 "매장 없이 체험하기" 흐름은 영향 없는지

## 구현·검증

### 구현 (`src/lib/screenAccess.js`)
`isScreenAllowed`에 `if (screen === 'landing') return !user`만 추가. `App.jsx`의 `goHome()`·새로고침 복원 `useEffect`·`handleLogout`은 코드 변경 없음.

### 테스트 (`src/lib/screenAccess.test.js`)
기존 "완전 공용 화면" 테스트에서 `landing` 케이스를 분리해 별도 테스트로 만들고, 로그인 상태면 `false`가 되도록 기대값 수정. 루트 테스트 11개 전부 통과, lint·build 통과.

### 브라우저 확인 (`claude-in-chrome`, 기존 테스트 계정 재사용)
- 사장님 계정으로 로그인된 상태에서 `localhost:5173` 새로고침(새 탭 진입과 동일) → 랜딩이 아니라 대시보드가 바로 뜸(수정 전엔 랜딩이었음).
- 리포트 화면으로 이동한 뒤 좌상단 `albafit` 로고 클릭 → 대시보드로 돌아옴(수정 전엔 랜딩으로 갔음).
- 로그아웃 → 로고와 무관하게 마케팅 랜딩 페이지가 정상적으로 그대로 보임 — 회귀 없음.
- 콘솔 에러 없음.
