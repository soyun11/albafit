# staff-nav-consistency.md — 알바 화면 상단바(AppNav) 완전 통일

> `docs/rubric-reuse.md`와 같은 방식으로 기록한다. 근거: 사용자가 알바 계정으로 화면을 오가며 지적한 UX 문제, 2026-07-22.

## 왜 고쳤나

오늘 `FeedbackReport.jsx`가 자체 nav 대신 공용 `AppNav`를 쓰도록 고쳤는데, 사용자가 알바 계정으로 여러 화면을 오가며 써보니 "어떤 걸 클릭하든 상단바는 동일하게 유지되고 싶다"고 지적했다. 알바가 실제로 도달 가능한 화면은 `scenario`(`ScenarioSelect.jsx`)·`training`(`TrainingSession.jsx`)·`feedback`(`FeedbackReport.jsx`)·`changePassword`(`ChangePassword.jsx`) 4개뿐이라 이 4개를 전부 조사했다.

코드로 확인한 원인 4가지:

1. `TrainingSession.css`의 `.session-page { padding: 24px 6% 60px }` — 다른 화면은 전부 `padding-bottom: 60px`만 있어서 `AppNav`가 화면 가장자리에 딱 붙는데, 훈련대화 화면만 top+좌우 패딩이 있어 `AppNav`가 안쪽으로 들어가 보인다.
2. `TrainingSession.jsx`의 `loading`/`startError` 상태는 아예 `AppNav` 없이 렌더링된다 — 훈련이 시작되는 짧은 순간·시작 실패 시 상단바 자체가 사라졌다가 다시 나타난다.
3. `ChangePassword.jsx`는 `AppNav`를 전혀 안 쓴다 — 로고 버튼 하나만 있는 `<nav className="auth-nav">`(Login/Signup과 같은 CSS 재사용)를 쓴다. "계정" 버튼을 누르면 상단바가 통째로 바뀐다.
4. `FeedbackReport.jsx`가 알바 자기 결과를 볼 때 `current='scenario'`로 넘겨서, 시나리오 화면에 있지도 않은데 "시나리오 선택" 링크가 거짓으로 active 표시된다.

## 결정

| 논점 | 결정 | 이유 |
|---|---|---|
| 훈련대화 화면 패딩 | `.session-page`의 top/좌우 패딩을 `.session-wrap`(콘텐츠 wrapper)으로 옮기고, `.session-page`는 다른 화면처럼 `padding-bottom`만 남긴다 | 콘텐츠 영역의 실제 여백(보기)은 그대로 두면서 `AppNav`만 다른 화면과 같은 위치에 오게 하는 최소 변경 |
| 로딩/에러 분기 | `loading`/`startError` 조기 return에도 `AppNav` 추가 | 이 두 상태도 여전히 "알바가 보고 있는 화면"이라 상단바가 사라지면 안 됨 |
| 비밀번호 변경 화면 | 자체 `<nav className="auth-nav">` 제거하고 공용 `AppNav` 사용 | Login/Signup(로그인 전)과 달리 이 화면은 로그인 후에만 오는 화면이라 역할별 링크가 있는 `AppNav`가 맞다 |
| 결과화면의 `current` | 알바 자기 결과 볼 때 `'scenario'` 대신 `undefined` | 실제로 시나리오 화면에 있지 않은데 링크가 active로 보이는 건 거짓 정보 |

## 다음 단계

1. ~~설계 문서화 (이 문서)~~ — 완료
2. `TrainingSession.css` 패딩 이동
3. `TrainingSession.jsx` loading/startError 분기에 `AppNav` 추가
4. `ChangePassword.jsx` + `App.jsx` — `AppNav`로 교체, prop 연결
5. `FeedbackReport.jsx` — `current` 기본값을 `undefined`로 수정
6. `npm test`(루트) + `npm run lint` + `npm run build` 통과 확인
7. 브라우저로 직접 확인: 시나리오 선택 → 훈련 시작 순간 → 훈련대화 → 결과화면 → 계정 화면까지 상단바가 흔들림 없이 유지되는지

## 구현·검증

### 구현
- `TrainingSession.css` — `.session-page`의 top/좌우 패딩을 제거(`padding-bottom: 60px`만 남김), `.session-wrap`에 `padding: 24px 6% 0`으로 옮김.
- `TrainingSession.jsx` — `loading`/`startError` 분기에 `AppNav` 추가.
- `ChangePassword.jsx`/`App.jsx` — 자체 `<nav className="auth-nav">` 제거하고 `AppNav` 사용, `role`/`onNavigate`/`onChangePassword`/`onLogout` prop 연결(`onHome` 제거). `Login.css`의 `.auth-nav`/`.logo-word`는 `Login.jsx`/`Signup.jsx`/`VerifyEmail.jsx`가 여전히 써서 삭제하지 않음.
- `FeedbackReport.jsx` — `current={onCalibrate ? 'reports' : undefined}`로 수정.
- 루트 테스트 11개 + lint + build 통과.

### 브라우저 확인 (`claude-in-chrome`, 기존 알바 테스트 계정)
- 시나리오 선택 → 시작 클릭 직후(로딩 문구만 뜨는 순간) → 훈련대화까지 `AppNav`가 한 번도 사라지지 않고 같은 위치(화면 가장자리)에 유지되는 것 확인.
- 답변 없이 "훈련 중단" → 결과화면에서 "시나리오 선택" 링크가 더 이상 거짓으로 active 표시 안 되는 것 확인(0점 표시도 여전히 정상).
- "계정" 클릭 → 비밀번호 변경 화면에도 동일한 `AppNav`(시나리오 선택/계정/로그아웃) 표시 확인.
- 전 구간 콘솔 에러 없음.

