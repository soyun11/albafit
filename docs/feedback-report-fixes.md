# feedback-report-fixes.md — 훈련 결과 화면 두 가지 수정

> `docs/home-navigation-fix.md`와 같은 방식으로 기록한다. 근거: 사용자가 알바 계정으로 직접 써보다 지적한 문제, 2026-07-22.

## 왜 고쳤나

알바 계정으로 캘리브레이션 기능을 수동 테스트하던 중 두 가지 문제가 발견됐다.

### 1. 훈련 결과 화면만 공용 상단바(AppNav)가 없음
`ScenarioSelect.jsx`·`TrainingSession.jsx`는 전부 공용 `AppNav`(`src/components/AppNav.jsx`)를 써서 계정/로그아웃/역할별 링크를 일관되게 보여주는데, 알바가 훈련을 마치고 도착하는 `FeedbackReport.jsx`만 자체 `<nav className="report-nav">`(로고 + "홈으로 돌아가기"만 있음)를 쓴다. 사장님이 리포트에서 남의 결과를 볼 때도 같은 화면을 쓰므로 owner 쪽도 똑같이 영향받는다.

### 2. 훈련을 하나도 안 하고 중단하면 점수가 100점으로 잘못 나옴
`TrainingSession.jsx`의 `handleAbortTraining`은 그 시점의 `heartsRemaining`/`maxHearts`를 그대로 결과 화면에 넘긴다. 답변을 하나도 안 낸 상태면 하트가 전혀 안 깎여서 `heartsRemaining === maxHearts`이고, `FeedbackReport.jsx`의 점수 계산(`maxHearts > 0 ? heartsRemaining/maxHearts*100 : ...`)이 이걸 그대로 100%로 표시한다. 문제는 "재시도 없이 기준을 다 채운 완벽한 세션"도 마찬가지로 하트가 안 깎여서 100%가 나온다는 것 — 즉 지금 공식은 "아무것도 안 함"과 "완벽하게 잘함"을 구분 못 한다.

## 결정

| 논점 | 결정 | 이유 |
|---|---|---|
| 상단바 | `FeedbackReport.jsx`의 자체 `<nav>`를 제거하고 다른 화면과 똑같이 `AppNav` 사용. `role`은 `App.jsx`의 실제 `user.role`을 그대로 전달 | 알바/사장님 어느 쪽이 봐도 계정·로그아웃·역할별 링크가 일관되게 보여야 한다. |
| 점수 계산 | **`passedCount === 0`이면 하트 비율과 무관하게 무조건 0점**, 그 외에는 기존 하트 비율 공식 유지 | "충족한 기준이 하나도 없다"는 팩트가 가장 확실한 신호다. 하트가 안 깎인 것만으로는 "안 함"과 "완벽히 함"을 구분 못 하지만, `passedCount`(실제 충족 기준 수)는 확실히 구분해준다. 기존 하트 비율 공식 자체(재시도 없이 통과하면 더 높은 점수)는 그대로 둔다 — 이건 다른 문제가 아니라 의도된 설계다. |
| "다시 훈련하기" 버튼 | (부수 발견) 사장님이 남의 리포트를 볼 때는 이 버튼을 숨김(`onCalibrate`가 있을 때, 즉 사장님 뷰일 때만 숨김) | 지금은 사장님이 눌러도 `scenario` 화면이 알바 전용이라 가드에 걸려 대시보드로 튕겨나가는 죽은 버튼이었다. 오늘 이 화면을 손보는 김에 같이 정리. |

## 다음 단계

1. ~~설계 문서화 (이 문서)~~ — 완료
2. `FeedbackReport.jsx` — `AppNav`로 교체, `role`/`onNavigate`/`onChangePassword`/`onLogout` prop 추가, `onHome` prop 제거, 점수 계산에 `passedCount === 0` 가드 추가, `onCalibrate`가 있으면 "다시 훈련하기" 버튼 숨김
3. `App.jsx`의 `'feedback'` 렌더 블록에 새 prop 연결 (`role={user?.role}` 등)
4. `npm test`(루트) + `npm run lint` + `npm run build` 통과 확인
5. 브라우저로 직접 확인: 알바 계정으로 훈련 하나도 안 하고 중단 → 0점 뜨는지, 결과 화면에 AppNav(계정/로그아웃/시나리오선택)가 보이는지. 사장님 계정으로 리포트 봤을 때도 AppNav 정상 + "다시 훈련하기" 버튼 안 보이는지

## 구현·검증

### 구현
- `src/components/FeedbackReport.jsx` — 자체 `<nav className="report-nav">` 제거하고 `AppNav`로 교체(`role`/`onNavigate`/`onChangePassword`/`onLogout` prop 추가, `onHome` prop 제거). 점수 계산에 `passedCount === 0 ? 0 : ...` 가드 추가. `onCalibrate`가 있을 때(사장님 뷰) "다시 훈련하기" 버튼 숨김.
- `src/components/FeedbackReport.css` — 이제 안 쓰는 `.report-nav`/`.logo-word`/`.nav-link` 규칙 삭제.
- `src/App.jsx` — `'feedback'` 렌더 블록에 `role={user?.role}`/`onNavigate`/`onChangePassword`/`onLogout` 연결, `onHome` 제거.
- 루트 테스트 11개 + lint + build 통과.

### 브라우저 확인 (`claude-in-chrome`, 기존 테스트 계정)
- 알바 계정으로 "매장 방문 손님 맞이하기" 시나리오 시작 → 답변 하나도 안 하고 바로 "훈련 중단" 클릭 → 결과 화면에 **0점**(수정 전엔 100점) + `AppNav`(시나리오 선택/계정/로그아웃) 정상 표시 확인.
- 사장님 계정으로 같은 알바의 다른 완료 세션(품절 시나리오, 1/1 충족) 리포트 진입 → `AppNav`(대시보드/기준관리/리포트/알바관리/계정/로그아웃) 정상 표시, "다시 훈련하기" 버튼은 안 보이고 "AI 채점 검토하기"만 보이는 것 확인.
- 두 경우 다 콘솔 에러 없음.
- 확인 후 원래 로그인돼 있던 알바 계정으로 다시 로그인해 세션 원복.
