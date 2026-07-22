# rubric-manage-reset-button-placement.md — "기준 재설정" 버튼 위치 수정

> `docs/rubric-reuse.md`와 같은 방식으로 기록한다. 근거: 사용자가 기준 관리 화면을 보다 지적한 UI 배치 문제, 2026-07-22.

## 왜 고쳤나

`RubricApproval.jsx`(기준 관리 화면, `onDone` 모드)에서 "기준 재설정" 버튼이 `AppNav`의 `children` 슬롯으로 들어가 있어, 상단바의 계정/로그아웃 옆에 떠 있었다. 사용자가 "이 화면(설명 문구 + 시나리오 탭 사이)에 있는 게 더 낫지 않냐"고 지적했다.

이 버튼은 `TrainingSession.jsx`의 "훈련 중단"(지금 진행 중인 세션에 대한 전역적 액션)과 성격이 다르다 — "기준 재설정"은 이 페이지(기준 관리)에서만 의미 있는 페이지 레벨 액션이라, 오늘 오전에 "알바 화면 상단바를 어딜 클릭해도 똑같이 유지되게" 통일한 원칙과도 더 잘 맞으려면 nav가 아니라 본문에 있어야 한다.

## 결정

| 논점 | 결정 | 이유 |
|---|---|---|
| 위치 | `AppNav`의 `children`에서 빼서, `.rubric-head`(마스코트·제목·설명 문구) 바로 아래, `.rubric-tabs`(시나리오 탭들) 위에 배치 | 사용자가 제안한 정확한 위치. 설명 문구("시나리오별 채점 기준이에요...") 바로 다음이라 "이 화면 전체를 다시 시작한다"는 의미가 자연스럽게 이어진다. |
| 스타일 | 기존 `.btn-primary-sm` 클래스 그대로 재사용(새 스타일 안 만듦), 가운데 정렬(`.rubric-head`와 같은 정렬 축) | 이미 있는 스타일을 재사용해 새 CSS를 늘리지 않는다. `.rubric-head`가 이미 전부 가운데 정렬이라 그 흐름을 그대로 따른다. |

## 다음 단계

1. ~~설계 문서화 (이 문서)~~ — 완료
2. `RubricApproval.jsx` — `AppNav` children에서 버튼 제거(온보딩 빈 상태 분기·메인 분기 둘 다), `.rubric-head`의 `<p className="sub">` 다음으로 이동
3. `RubricApproval.css` — 버튼을 감싸는 간단한 wrapper에 margin만 추가(새 색상/버튼 스타일 없음)
4. `npm test`(루트) + `npm run lint` + `npm run build`
5. 브라우저로 사장님 계정 확인 — 기준 관리 화면에서 버튼이 본문에 보이는지, nav에서는 사라졌는지

## 구현·검증

### 구현
- `RubricApproval.jsx` — `AppNav`의 `children`에서 버튼 제거(빈 상태 분기·메인 분기 둘 다), `.rubric-head`의 `<p className="sub">` 다음(`.rubric-tabs` 이전)으로 이동. 클래스는 기존 `.btn-primary-sm` 그대로 재사용.
- `RubricApproval.css` — `.reset-rules-btn`에 `margin-bottom: 4px`만 추가.
- 루트 테스트 12개 + lint + build 통과.

### 브라우저 확인 (`claude-in-chrome`, 기존 사장님 테스트 계정)
- 기준 관리 화면에서 "기준 재설정" 버튼이 설명 문구와 시나리오 탭 사이에 표시됨, 상단바에서는 사라짐.
- 버튼 클릭 → 기존과 동일하게 재설정 흐름(StepSidebar 2단계 "규칙확인")으로 정상 진입 확인 — 기능 자체는 변경 없음, 위치만 이동.
- 콘솔 에러 없음.
