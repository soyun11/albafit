# staff-report-and-rubric-fix.md — 리포트 실데이터 연결 + 루브릭 상황 스코핑 버그 수정

> `docs/rubric-reset-flow.md`와 같은 방식으로 기록한다.

## 배경

`docs/checklist.md`의 "UI mock → 실제 API 교체" 항목을 점검하다가, 알바 훈련 대화는 실제 API로 연결됐지만 **사장님 대시보드 통계**와 **알바 리포트 목록·상세**는 여전히 하드코딩된 mock 데이터(이서준/박지호/최유나/김민지, "6명 전체 알바" 등)라는 걸 확인했다. 사용자 요청으로 이 부분을 실제 훈련 기록 기반으로 연결했다.

## 1. 알바별 집계 — `GET /api/stores/me/staff-report`

### 데이터 모델 제약
`training_sessions`에는 알바 계정을 가리키는 외래키가 없고 `staff_label`(자유 텍스트)만 있다 — 원래 "로그인 없는 알바가 리포트 구분용으로 남기는 별칭" 용도였다. 지금은 `TrainingSession.jsx`가 로그인한 알바의 `user.name`을 자동으로 `staffLabel`에 넣어주므로, **이름이 같으면 같은 사람**이라고 보고 매칭했다 — 동명이인이 있으면 섞일 수 있는 한계가 있고, 정확한 방법은 나중에 `training_sessions`에 `staff_id` 외래키를 추가하는 것이다(오늘 범위 밖).

### 계산 방식
- **진행률/완료**: 이 매장 시나리오 종류 수(보통 3개) 중 그 알바가 완료(`status: 'completed'`)한 서로 다른 시나리오 종류 수. `2/3`처럼 표시.
- **최근 점수**: 가장 최근에 끝낸 세션 "하나"의 기준 충족률 — 전체 누적 평균이 아니라 최신 상태. 턴마다 같은 기준을 반복 평가하므로, 턴 전체의 `met_items`를 그대로 합산하면 안 되고 **기준 항목별로 "한 번이라도 충족했는지"만** 세야 한다(아래 상세 리포트와 계산 방식을 반드시 맞춰야 함 — 처음엔 안 맞춰서 목록 20점/상세 0점처럼 서로 다르게 보이는 버그가 있었다, 2절 참고).
- **상태**: 세션이 하나도 없으면 `pending`, 전체 시나리오 종류를 다 완료했으면 `done`, 그 사이면 `active`.
- **대시보드 통계**: `staff-report` 응답의 `stats`(전체 알바수/평균점수/훈련중/응답대기중)를 그대로 씀 — 별도 API 안 만들고 재사용.
- **코치 팁**: 이 매장 전체에서 "어떤 알바가 어떤 기준을 가장 자주 놓쳤는지" 집계해서 가장 많이 놓친 것 하나를 자동으로 뽑는다.

## 2. 상세 리포트 — `GET /api/stores/me/staff/:staffId/latest-report` 와 점수 불일치 버그

처음엔 체크리스트를 만들 때 **"지금 승인돼있는 최신 루브릭"의 `criteria`**를 기준으로 `metLabels.has(c.item)`를 체크했다. 그런데 "기준 재설정"으로 루브릭 문구가 그 세션 이후에 바뀌면, 그 세션 당시 평가 기록(`evaluation.metItems`)의 문구와 지금 루브릭 문구가 달라서 전부 "미충족"으로 잘못 표시됐다 — 실제로 목록에서는 20점인데 상세화면을 열면 0점이 뜨는 버그로 나타났다.

**수정**: 체크리스트는 현재 루브릭을 다시 조회하지 않고, **그 세션의 turn마다 실제로 채점됐던 기준(`evaluation.metItems`)에서 그대로** 뽑는다. 리포트는 "지금 기준으로 다시 채점하면 어떨지"가 아니라 "그 순간 실제로 무엇을 기준으로 채점됐는지"를 보여줘야 하기 때문이다. 이렇게 하니 목록 점수와 상세 점수가 항상 같은 데이터·같은 계산식을 쓰게 되어 자동으로 일치한다.

## 3. 별개로 발견한 버그 — 루브릭이 시나리오 상황과 무관한 기준까지 포함

리포트 기능을 테스트하던 중, "음료 지연"(이미 주문하고 대기 중인 상황) 시나리오의 채점 기준에 "주문 시작 인사말", "포장 여부 확인", "퇴점 인사말"처럼 **주문 처음부터 끝까지의 전체 흐름 기준**이 다 들어가 있는 걸 발견했다. `generateRubric()`이 시나리오의 **구체적 상황 설명**(예: "이미 주문하고 기다리는 중") 없이 `scenarioType`/`scenarioTitle`만 받고 있었던 게 원인 — `customerAgent.js`엔 이미 각 시나리오별 상황 설명(`situation`)이 있었는데 루브릭 생성 쪽엔 안 넘어가고 있었다.

**수정**:
- `industryScenarios.js`의 각 시나리오 항목에 `situation` 필드 추가(`customerAgent.js`의 문장과 동일하게 맞춤 — 두 곳이 어긋나지 않게).
- `rubric.js`의 `generateRubric()`이 `situation`을 받아 프롬프트에 포함하고, "그 순간 자연스럽게 나올 수 없는 기준은 넣지 않는다"는 원칙을 시스템 프롬프트에 명시.
- `stores.js`(매장 규칙 제출)·`guest.js`(체험하기)의 `generateRubric()` 호출부 둘 다 `situation` 전달하도록 수정.

**검증**: 데모 계정에서 "기준 재설정" → 규칙 재제출 → "음료 지연" 루브릭을 다시 생성해보니, 기존 4개 기준(주문시작인사/포장확인/컵리드/퇴점인사) 중 상황과 무관한 2개(주문시작인사, 포장확인)가 빠지고 실제로 이 순간 나올 수 있는 2개(퇴점인사, 컵리드)만 남는 것 확인. 좋은 예시 문장("오래 기다리게 해드려 죄송합니다. 주문하신 음료 나왔습니다...")도 지연 상황에 맞게 나옴.

## 4. 프론트 연결
- `OwnerDashboard.jsx` — `useEffect`로 `/me/staff-report` 호출, 통계 4개 카드 + 코치팁을 실데이터로 교체. 코치팁은 `coachTip`이 없으면(아직 미충족 기록이 없으면) 패널 자체를 숨김.
- `ReportList.jsx` — 하드코딩 `STAFF` 배열 제거, 같은 API로 목록 렌더. `status: 'pending'`(훈련 기록 없음)인 행은 클릭 비활성화(어차피 상세 리포트가 없어서 404남).
- `App.jsx`의 `handleViewReport` — 클릭한 staffId로 `/me/staff/:id/latest-report`를 실제로 호출해서 `checklist`를 받아 `FeedbackReport`에 전달(예전엔 항상 `DEFAULT_ITEMS` mock을 보여줬음).

## 알려진 한계 (오늘 범위 밖)
- `staff_label` 이름 매칭 방식이라 동명이인 알바가 있으면 기록이 섞인다 — 정확한 해결은 `training_sessions.staff_id` 외래키 추가.
- 재검증 중 React StrictMode 개발 모드에서 세션 시작 API가 두 번 불릴 수 있다는 정황을 발견(같은 화면에서 두 시나리오 타입이 거의 동시에 완료 처리된 사례 관찰) — 오늘 작업 범위는 아니라 별도로 남겨둠, 프로덕션 빌드(StrictMode 미적용)에선 발생하지 않음.

## 검증
- Playwright: 알바로 로그인 → 시나리오 하나 3턴 완료 → 사장님으로 전환 → 대시보드 통계·코치팁이 실제 값으로 바뀌는 것 확인 → 리포트 목록에서 실제 진행률·점수 확인 → 행 클릭 → 상세 리포트가 그 세션의 실제 체크리스트로 뜨는 것 확인 → 목록 점수와 상세 점수 일치(20점 = 20점) 확인.
- `npm run lint` 통과.

## 5. 마지막으로 남아있던 mock 2개 — 훈련 시간·업종 태그

전체 점검(체크리스트 재확인) 중 `FeedbackReport.jsx`에 여전히 하드코딩된 값 2개를 발견해서 같이 고쳤다: "총 훈련 시간"이 항상 "18분" 고정이었고, 업종 태그도 항상 "카페 · 디저트 기준" 고정이었다(실제 매장 업종과 무관).

- `POST /api/sessions/:id/turns`(3턴째, 완료 시점) — `completedAt - session.startedAt`으로 실제 소요 분을 계산해 응답에 `durationMinutes` 추가.
- `GET /me/staff/:staffId/latest-report`도 같은 방식으로 `durationMinutes` 계산 + `store.industry` 조회해서 같이 반환.
- `TrainingSession.jsx`가 훈련 종료 시 이 값을 `onFinish`로 같이 넘기고, `App.jsx`가 `trainingResult`에 담아 `FeedbackReport`에 전달. 업종은 `src/lib/industries.js`의 `INDUSTRIES` 목록으로 라벨 변환(다른 화면들과 동일한 패턴).

**검증**: 알바로 실제 훈련 하나(3턴) 끝까지 진행 → "총 훈련 시간"이 "18분"이 아니라 실제 경과 시간("1분")으로 뜨는 것 확인. `npm run lint` 통과.

## 추가 결정 (2026-07-28) — 왜 리포트에만 훈련 시간이 뜨는가 + 분·초 표시

"총 훈련 시간"을 왜 만들었는지, 왜 훈련 중에는 안 보여주고 리포트에만 보여주는지 질문이 나와서 정리한다.

| 논점 | 결정 | 이유 |
|---|---|---|
| 왜 만들었나 | 리포트에 "총 훈련 시간" 항목 유지 | 위 5절에서 보듯 원래 목업(`ui/8_사장님리포트.png`)에 이미 있던 항목이었고, 처음엔 "18분" 고정값이었다가 실제 `completedAt - startedAt`으로 교체했다 — 이건 기존 기록에서 그대로 확인되는 사실이다. |
| 왜 리포트에만 뜨고 훈련 중엔 안 뜨나 | 그대로 둔다(훈련 화면에 실시간 타이머 추가 안 함) | 이 값 자체가 `completedAt`(세션이 끝나야 생기는 값) 기준으로 계산되므로 훈련 진행 중엔 애초에 값이 존재하지 않는다. 추가로, 이 서비스는 재입력(하트)을 편하게 여러 번 시도해보라는 설계인데(`docs/multi-turn-conversation-fix.md`) 화면에 초시계가 째깍거리면 알바가 시간에 쫓겨 답을 서두르게 될 수 있어 그 설계 의도와 어긋난다고 판단했다. *(이 두 번째 이유는 코드나 커밋 기록으로 검증된 사실이 아니라, 기존 설계 방향에 비춰본 추정이다.)* |
| 분만 있던 표시를 분+초로 | `durationMinutes`(분, 1분 미만 반올림) → `durationSeconds`(초, `Math.max(1, ...)` 바닥값 제거)로 이름과 단위를 바꾸고, 프론트에 `src/lib/formatDuration.js`를 새로 만들어 "M분 N초"(1분 미만이면 "N초"만)로 표시 | 분 단위만 있으면 1분 미만 훈련은 전부 "1분"으로 뭉개져서(바닥값 때문에) 짧은 세션끼리 구분이 안 됐다. 서버는 초 단위 숫자만 돌려주고 "M분 N초" 포맷팅은 프론트 전용 헬퍼로 뺐다 — server/`src`와 `src`(프론트)는 서로 코드를 import할 수 없는 별도 번들이라(CLAUDE.md), 표시 문자열 자체를 서버에서 만들어 내려주지 않는다. |

### 구현

- `server/src/lib/sessionTurns.js`의 `buildSessionReportPayload()`: `durationMinutes` 계산을 `durationSeconds = Math.round((completedAt - startedAt) / 1000)`로 교체(바닥값 제거 — 초 단위라 0초짜리도 정직하게 보여줄 수 있음).
- `server/src/routes/sessions.js`의 턴 완료 응답도 동일하게 `durationSeconds`로 교체.
- `src/lib/formatDuration.js`(신규): `formatDuration(totalSeconds)` — null이면 null, 1분 미만이면 "N초", 그 외 "M분 N초".
- `TrainingSession.jsx` → `App.jsx` → `FeedbackReport.jsx`로 이어지는 `durationMinutes` prop/state 체인을 전부 `durationSeconds`로 리네임하고, `FeedbackReport.jsx`의 표시부만 `formatDuration(durationSeconds) ?? '—'`로 교체.

### 검증

- `npx vitest run`(프론트) + `server`쪽 `npx vitest run` 모두 통과 — `sessionTurns.test.js`의 기존 `durationMinutes` 단언을 `durationSeconds`(예: 5분 케이스 → `300`)로 갱신하고, `formatDuration.test.js`(신규)로 45초/1분23초/null 세 케이스 확인.
- `npm run lint` 통과(기존에도 있던 `RulesInput.jsx` 경고 2건 외 신규 경고 없음).
