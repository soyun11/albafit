# appnav-audit-fixes.md — AppNav 사용자 관점 추가 개선

> `docs/rubric-reuse.md`와 같은 방식으로 기록한다. 근거: 사용자가 "상단바가 최선이냐"고 물어 진행한 코드 감사, 2026-07-22.

## 왜 고쳤나

알바 화면 4개에서 `AppNav`가 흔들리지 않게 통일한 직후, 사용자가 "상단바가 저게 최선이냐, 더 개선할 부분 없는지 조사해달라"고 요청했다. `AppNav.jsx`/`AppNav.css`를 다시 감사해 코드 근거가 있는 문제 3가지를 찾았다.

## 결정

| 논점 | 결정 | 이유 |
|---|---|---|
| A. 좁은 화면(모바일) 대응 | `AppNav.css`에 `@media (max-width: 700px)` 추가 — gap·padding 축소 + `flex-wrap: wrap`으로 자연스럽게 두 줄로 내려가게. 햄버거 메뉴 등 새 마크업/상태는 추가하지 않음 | `grep -rn "@media" src`로 확인한 결과 이 프로젝트의 다른 주요 화면 컴포넌트는 전부 반응형 규칙이 있는데 `AppNav.css`만 없었다. 다른 컴포넌트들도 전부 "구조 변경 아니라 gap/padding/방향 조정" 수준이라 같은 톤을 맞춘다 — 햄버거 메뉴는 이 규모에 과설계. `docs/backlog.md`의 "반응형/모바일 점검"(GitHub #9, 3주차 7/23)과 겹치는 항목이라 그 백로그를 당겨서 처리하는 셈이다. |
| B. 활성 화면 접근성 표시 | `aria-current={current === link.key ? 'page' : undefined}` 추가, 시각적 `.active` 클래스는 그대로 유지 | 지금은 색상(파란색)에만 의존해 스크린리더 사용자가 현재 화면을 알 방법이 없었다. |
| C. 비활성 링크 안내 | `title` 툴팁 제거하고, 비활성 링크 안에 항상 보이는 캡션(`app-nav-link-hint`)으로 대체 | `title`은 마우스 호버에만 반응해 터치 기기(모바일)에서는 안내 자체가 안 보였다. |

## 다음 단계

1. ~~설계 문서화 (이 문서)~~ — 완료
2. `AppNav.jsx`에 `aria-current` 추가
3. `AppNav.jsx`/`AppNav.css` — 비활성 링크 안내를 `title`에서 상시 캡션으로 교체
4. `AppNav.css`에 `@media (max-width: 700px)` 반응형 규칙 추가
5. `npm test`(루트) + `npm run lint` + `npm run build` 통과 확인
6. 브라우저로 owner/staff 양쪽 확인 — `aria-current` 값, 비활성 링크 캡션이 항상 보이는지, 좁은 화면에서 겹침 없이 줄바꿈되는지

## 구현·검증

### 구현
- `AppNav.jsx` — 링크 버튼에 `aria-current={current === link.key ? 'page' : undefined}` 추가. `disabledKeys`로 비활성화된 링크의 `title` 툴팁을 제거하고 항상 보이는 `<span className="app-nav-link-hint">` 캡션으로 교체.
- `AppNav.css` — `.app-nav-link-hint` 스타일 추가, `@media (max-width: 700px)`에 `flex-wrap`/gap·padding 축소 규칙 추가.
- 루트 테스트 11개 + lint + build 통과.

### 브라우저 확인
- `document.querySelector('.app-nav-link.active').getAttribute('aria-current')` → `"page"` 확인.
- **`resize_window` 도구가 이 환경에서 실제 뷰포트 크기를 안정적으로 바꿔주지 못해**(요청과 다른 값으로 튐, `window.innerWidth`가 그대로 유지됨) 실제 디바이스 리사이즈로는 검증 못 했다. 대신 `<style>` 태그를 임시로 주입해 `@media (max-width: 700px)`와 동일한 규칙 + `body { max-width: 390px }` 제약을 강제로 적용한 뒤 스크린샷으로 확인:
  - 알바 nav(로고+링크1개+계정+로그아웃): 390px 폭에서 한 줄에 깨끗하게 들어감.
  - 사장님 nav(로고+링크4개+"+ 알바 초대"+계정+로그아웃, 가장 항목이 많은 케이스): 390px 폭에서 겹침·잘림 없이 2줄로 자연스럽게 줄바꿈됨(1행: 로고+링크4개, 2행: 알바초대+계정+로그아웃).
  - 확인 후 임시 스타일은 제거.
- 비활성 링크 캡션(`app-nav-link-hint`)은 온보딩 중(매장 미설정) 상태에서만 나타나는 케이스라 이번 세션의 테스트 계정(이미 매장 있음)으로는 직접 못 봤다 — 코드 경로상 `disabledKeys` prop이 그대로 있고 조건부 렌더링만 바꾼 것이라 로직 자체는 기존과 동일, 렌더링 방식만 `title`→`span`으로 바뀜.
- 전 구간 콘솔 에러 없음. 검증에 쓴 로그인 세션은 알바 계정으로 복원.
