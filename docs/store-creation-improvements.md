# store-creation-improvements.md — 매장 만들기·업종별 시나리오·루브릭 관리 개선

> 로그인 개선(`docs/auth-improvement-plan.md`)과 같은 방식으로 기록한다. "매장 만들기" 기능(`server/src/routes/stores.js`)을 다시 훑어보다가 발견한 문제와 수정 내용.

## 발견한 문제 (심각도순)

### 1. `POST /:linkKey/rules`에 인증이 아예 없었음 (보안 취약점)
로그인 여부도, 그 매장 소유자인지도 확인하지 않았다. `linkKey`만 알면(또는 추측하면) 누구나 그 매장에 규칙을 밀어넣어 Gemini를 시나리오 수만큼(3번) 호출시킬 수 있었다. Gemini 무료 티어는 하루 20회 한도라(로그인 개선 작업 중 직접 겪음), 악용되면 서비스 전체의 AI 기능이 하루 동안 마비될 수 있는 실질적 위험이었다.

**수정**: `requireAuth` + `requireRole('owner')` + 소유권 확인(`store.id !== req.user.storeId` → 403) 추가.

### 2. 매장 중복 생성 방지 없음
이미 매장이 있는 사장님이 `POST /api/stores`를 또 호출하면 새 매장을 만들고 기존 매장 연결을 덮어써서, 기존 매장이 고아 상태가 됐다.

**수정**: `req.user.storeId`가 이미 있으면 409로 막는다.

### 3. 업종을 뭘 골라도 항상 카페 시나리오만 생성됨
`IndustrySelect.jsx`에서 6개 업종을 고를 수 있었지만, 뒷단(`stores.js`의 `CAFE_SCENARIOS`)이 고정이라 편의점·음식점 등을 골라도 항상 카페 문구가 나왔다. `ScenarioSelect.jsx`·`TrainingSession.jsx`도 카페 3종으로 하드코딩돼 있었다.

**수정**: 6개 업종(카페/편의점/음식점/마트/PC방/뷰티) 전체 파이프라인 확장.
- `server/src/routes/stores.js` — `INDUSTRY_SCENARIOS` 맵(업종별 3개씩, 총 18개 시나리오)
- `server/src/lib/customerAgent.js` — 업종별 손님 오프닝 대사·상황 설명 15개 추가
- `src/components/ScenarioSelect.jsx` — 업종별 6세트로 확장, 백엔드 `type` 값을 그대로 key로 써서 변환 계층 제거
- `src/components/TrainingSession.jsx` — `SCENARIO_TYPE_MAP`(camelCase↔snake_case 변환표) 삭제, 헤더의 "카페 훈련 세션" 고정 문구도 "훈련 세션"으로 일반화
- `src/components/OwnerDashboard.jsx` — 상단 "☕ 카페 · 디저트 기준 적용중" 태그도 실제 업종에 맞게 표시되도록 수정

### 4. 대시보드에서 루브릭을 다시 볼 방법이 없었음
`RubricApproval` 화면은 온보딩 흐름 중에만 접근 가능했고, 대시보드의 "기준 관리" 링크는 클릭해도 아무 동작 안 하는 장식용 `<span>`이었다 — 한 번 승인한 뒤엔 사장님이 루브릭을 다시 확인·수정할 방법이 없었다.

**수정**: `GET /api/stores/me/rubrics` 신규(내 매장의 모든 시나리오+최신 루브릭 반환), 대시보드 "기준 관리"를 이 API를 호출해 `RubricApproval` 컴포넌트를 재사용하는 화면으로 연결. `RubricApproval`에 `onDone` prop을 추가해서, 대시보드에서 들어온 경우엔 "알바 초대하기" 대신 "대시보드로 돌아가기"를 보여주도록 분기.

## 아직 안 고친 것 (알고 있는 제한)
- `RulesInput.jsx`의 기본 예시 규칙(`INITIAL_RULES`)이 업종과 무관하게 항상 카페 문구로 고정돼 있다. 오늘 범위(백엔드 시나리오·손님 에이전트·시나리오 선택·대시보드)보다 더 큰 작업(업종별 예시 규정 세트 필요)이라 다음으로 미룬다.
- `FeedbackReport.jsx`, `LandingPage.jsx` 등 나머지 화면에도 "카페" 문구가 마케팅 카피/mock 데이터로 남아있지만, 실사용 흐름에 지장은 없어서 우선순위 낮음.

## 검증
- curl: 미인증 규칙저장 401, 타 매장 소유자 403, 본인 매장 정상 동작, 매장 중복생성 409, `GET /api/stores/me/rubrics` 정상 응답 — 전부 확인.
- 브라우저: 편의점 업종으로 가입→매장생성→규칙입력→루브릭 3개 승인까지 진행 후 실제로 "품절 상품/미성년자 확인/결제·포인트 실수" 문구로 생성되는지 확인. 알바 계정을 만들어 로그인 후 시나리오선택 화면에 편의점 시나리오 3개가 뜨는 것, "미성년자 확인" 시나리오로 훈련 세션을 진행해 손님이 실제로 "나이가 몇인지 확인해야 하나요?"처럼 업종에 맞게 반응하는 것까지 확인. 뷰티 업종으로도 별도 확인해 대시보드 태그가 "💇 뷰티 · 헤어 기준 적용중"으로 정확히 뜨는 것 확인. 대시보드 "기준 관리" 클릭 → 이미 승인된 루브릭 3개가 탭으로 뜨는 것까지 확인.
- `npm run lint` 통과.
