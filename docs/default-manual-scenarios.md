# default-manual-scenarios.md — 업종별 기본 매뉴얼을 실제 훈련 콘텐츠로

> `docs/rubric-reuse.md`와 같은 방식으로 기록한다. 관련: `soyun11/hub#13`(온보딩 가드 이슈, 이번 기능으로 대체·이슈는 코멘트로 남기고 종료), `docs/scenario-generation-redesign.md`(이 설계가 만든 `storeRuleId` 기반 "최신 배치만 노출" 필터를 그대로 재사용).

## 왜 만들었나

지금은 사장님이 매장을 만들어도 규칙을 직접 제출·승인하기 전까진 `GET /me/training-scenarios`가 빈 배열을 반환해서 알바가 훈련을 아예 시작할 수 없다(콜드스타트). 처음엔 이 상태를 사장님에게 안내만 하는 배너(`docs/onboarding-guard.md`, `src/components/OnboardingBanner.jsx`)로 풀려고 했으나, 논의 중 "업종별 기본 매뉴얼을 알바가 바로 쓸 수 있게 만들면 안내 자체가 필요 없어진다"는 방향으로 바뀌었다. 이 문서는 그 전환된 설계를 기록한다.

지금 있는 `src/components/RulesInput.jsx`의 `INITIAL_RULES`(카페 전용 하드코딩 예시 규칙 카드 4개)는 사장님이 참고할 텍스트일 뿐, 제출·승인 전까진 DB에 저장되지 않아 알바가 실제로 쓸 수 있는 콘텐츠가 아니다. 이번 기능은 이 "예시"를 매장 생성 즉시 실제 훈련 가능한 콘텐츠로 승격시킨다.

## 결정

| 논점 | 결정 | 이유 |
|---|---|---|
| 기본 시나리오+루브릭을 언제 만드나 | **매장 생성 시점(`POST /api/stores`)에 즉시 시딩**, lazy 생성은 안 씀 | 매장 생성은 사장님당 한 번뿐(재생성 막혀있음, 409)이라 그 자리에서 만들면 "누가 처음 조회하느냐"에 따른 동시성 걱정이 없다. |
| `approvedAt`을 기본 콘텐츠에 어떻게 채우나 | **진짜로 non-null 값(생성 시각)을 채워 "승인됨" 상태로 시작** — `isDefault` 같은 새 플래그 컬럼은 만들지 않음(구분은 `storeRuleId === null`로 함) | 기존 조회 코드(`GET /me/training-scenarios`, `/me/rubrics`, `/me/staff-report`)가 전부 `rubrics: { some: { approvedAt: { not: null } } }`로 거른다 — 이걸 그대로 재사용하면 세 라우트를 한 줄도 안 고쳐도 기본 콘텐츠가 알바에게 바로 보인다. `CLAUDE.md`의 "AI 생성물은 승인 필요" 원칙은 이 매장 전용 커스텀 생성물을 겨냥한 것이지, 플랫폼이 미리 다듬어둔 범용 템플릿까지 막는 게 아니라고 판단(2026-07-27 대화에서 확정). |
| "최신 배치만 노출" 필터와 기본 콘텐츠 공존 — 기본 콘텐츠의 `storeRuleId`는? | **`null`** | 매장을 막 만든 시점엔 `StoreRule`이 하나도 없어 `getLatestStoreRuleId`가 `null`을 반환한다 — 기존 필터 조건 `storeRuleId === latestStoreRuleId`가 `null === null`로 자동 통과된다. 필터 코드를 전혀 안 고쳐도 성립. |
| 사장님이 커스텀 규칙을 실제로 제출하면 기본 매뉴얼은? | **자동으로 화면에서 사라짐(DB 삭제는 안 함)** | 제출 순간 새 `StoreRule`이 생겨 `latestStoreRuleId`가 바뀌고, 기본 콘텐츠(`storeRuleId: null`)는 더 이상 "최신 배치" 조건을 못 만족해 자연히 숨는다. "원문은 지우지 않는다"는 기존 철학과도 일치. **알려진 한계**: 제출 즉시(승인 전에도) 전환이 일어나므로, 제출 후 승인 전까지 알바 화면이 짧게 다시 비는 공백이 생긴다. 사장님이 능동적으로 규칙을 바꿀 때만 생기는 좁은 케이스라 오늘은 감수하고 넘어간다. |
| 기본 매뉴얼을 "수정"하면 AI 파이프라인을 타나 | **탄다 — 기존 `POST /:linkKey/rules` 흐름 그대로**, 별도 in-place 편집 기능 없음 | 사장님이 기본 매뉴얼 카드를 고쳐서 제출하는 것 자체가 곧 "기본값을 초안 삼아 커스텀 배치를 새로 만드는" 기존 규칙 제출 액션이다. 새로 짤 코드가 없다. |
| 기준관리(`RubricApproval.jsx`) 화면에서 기본 콘텐츠 표시 | **기존 화면 그대로 재사용**, 신규 화면 없음 | 기본 콘텐츠도 `approvedAt`이 채워져 있어 "이미 승인된 루브릭" 조회 경로(`GET /me/rubrics`)를 그대로 탄다. |
| 알바 화면에 "기본"이라고 표시하는 방법 | **`GET /me/training-scenarios` 응답에 `isDefault` boolean 필드 추가**(서버가 `storeRuleId === null` 여부로 계산), 프론트는 작은 배지만 표시 | 프론트가 직접 `storeRuleId` 유무를 해석하게 하는 것보다 서버가 의미 있는 이름으로 계산해 내려주는 게 더 단순함. |
| 시딩 데이터 소스 | **새 정적 파일 `server/src/lib/defaultScenarios.js` 신규 작성**(업종별 `{title, situation, opening, criteria}`), `INITIAL_RULES`(프론트 규칙 카드)·`INDUSTRY_SCENARIOS`(guest 전용 situation, `industryScenarios.js`)는 합치지 않고 그대로 둠 | 세 데이터는 소비자·모양이 다 다르다. `INDUSTRY_SCENARIOS`는 `scenario-generation-redesign.md`에서 이미 "guest.js가 독립적으로 계속 씀, 안 건드림"으로 확정돼 있다. 억지로 합치면 각 소비자 코드에 불필요한 분기만 늘어난다. **AI(Gemini) 호출은 시딩 시점(매장 생성마다)에 넣지 않는다** — 정적 데이터라 매장 생성 API 응답 속도·Gemini 무료 티어 일일 호출 한도(20회)에 영향 없음. |
| 업종 6개를 오늘 다 채울까 | **처음엔 "카페만" 결정 → 이후 다른 업종도 부스에서 보여주고 싶다는 요청으로 6개 전부 채우는 걸로 변경(같은 날 추가 작업)** | `industryScenarios.js`(guest 전용, situation)와 `customerAgent.js`(opening)에 6개 업종 문장이 이미 다 있어서, criteria만 새로 쓰면 됐다 — 업종당 새 로직 없이 데이터만 추가하는 구조라 예상보다 비용이 낮았음. |
| `OnboardingBanner.jsx`/`.css`·`docs/onboarding-guard.md` | **폐기(삭제)** | 배너가 막으려던 문제는 새 매장부터 기본 콘텐츠가 항상 승인된 채로 존재해 애초에 안 생긴다. 남은 유일한 예외(재제출~재승인 사이 공백)만을 위해 유지할 실익이 낮다. |

## 완료 기준

매장을 새로 만든 직후, 사장님이 규칙을 하나도 제출·승인하지 않아도 알바가 로그인해서 바로 시나리오를 골라 훈련을 시작할 수 있고, 알바 화면엔 "기본 매뉴얼" 표시가 보인다. 사장님이 실제로 규칙을 커스텀 제출·승인하면 그 커스텀 내용으로 자연스럽게 교체된다.

## 다음 단계

1. ~~설계 문서화 (이 문서)~~ — 완료
2. `server/src/lib/defaultScenarios.js`(신규) — `buildDefaultSeedData(industry, now)` 순수 함수, 카페 시나리오 3개(음료 지연·품절 메뉴·커스텀 음료 요청) 데이터 포함
3. `server/src/lib/defaultScenarios.test.js`(RED 먼저) — storeRuleId null, approvedAt=now, type 순번, 미지원 업종 빈 배열, criteria 형태 검증
4. `server/src/routes/stores.js`의 `POST /`에 시딩 로직 삽입(독립 try/catch), `GET /me/training-scenarios`에 `isDefault` 필드 추가
5. `src/components/ScenarioSelect.jsx`/`.css` — "기본" 배지 표시
6. `src/components/OnboardingBanner.jsx`/`.css`, `docs/onboarding-guard.md` 삭제(배너 방식 폐기)
7. 서버 테스트 + 루트 lint + 브라우저/curl 확인

## 구현·검증

### 구현
- `server/src/lib/defaultScenarios.js`(신규) — `DEFAULT_SCENARIOS.cafe`에 시나리오 3개(각 criteria 3개, `{item, required, good_example, bad_example}` 형식), `buildDefaultSeedData(industry, now)` 순수 함수. `industryScenarios.js`(guest 전용)의 situation 문장을 참고했지만 파일 자체는 건드리지 않음.
- `server/src/lib/defaultScenarios.test.js`(신규) — 7개 테스트(storeRuleId null·approvedAt=now·type 순번·미지원 업종 빈 배열·criteria 형태 등), RED→GREEN.
- `server/src/routes/stores.js` — `POST /`의 `owner` 업데이트 직후·`accessToken` 발급 직전에 시딩 로직 삽입. 독립 `try/catch`로 감싸 시딩 실패가 매장 생성 자체를 실패시키지 않게 함(`console.error`만 남김). `GET /me/training-scenarios` 응답에 `isDefault: s.storeRuleId === null` 필드 추가.
- `src/components/ScenarioSelect.jsx`/`.css` — 시나리오 제목 옆에 `isDefault`일 때만 "기본" 배지(작은 회색 칩, 기존 디자인 토큰 재사용) 표시.
- `src/components/OnboardingBanner.jsx`/`.css`, `docs/onboarding-guard.md` 삭제 — 어디에도 연결된 적 없어 다른 파일에 영향 없음.
- 서버 테스트 97개 + 루트 lint 통과(기존 무관 경고 1건 제외).

### 검증
- **시딩 실패 격리** — 시딩 DB 쓰기를 `server/src/lib/defaultScenarios.js`의 `seedDefaultScenarios()`로 뽑아내고 TDD로 6개 테스트 추가(RED→GREEN): 개수·storeId 연결·scenarioId 연결·미지원 업종 무시·**DB 쓰기 실패해도 절대 throw 안 함**·실패 시점 이후는 시도 안 함. `stores.js`의 `POST /`는 이제 이 함수를 호출만 하고 별도 try/catch가 필요 없음(함수 자체가 안전 보장).
- **feature-verifier 에이전트(curl, 실제 Supabase 프로덕션 DB)** — 새 계정 회원가입 → 매장 생성(카페) → 규칙 미제출 상태로 `GET /me/training-scenarios` → 3개 전부 `isDefault:true` 확인. 편의점(시딩 데이터 없음)은 `{"scenarios":[]}` 확인. **기본 시나리오로 실제 훈련 세션 시작 + 답변 1턴 제출**(OpenAI 손님 응답 + Gemini 채점 전부 실제 호출) → 정상 동작 확인 — 기본 시나리오도 AI 생성 시나리오와 동일한 필드 모양이라 기존 세션/턴 로직이 그대로 소비함을 실제로 확인.
- **브라우저 실제 클릭 확인(claude-in-chrome)** — 새 사장님 계정으로 회원가입 → 카페 매장 생성(규칙 입력 없이 바로 "다음") → 대시보드에서 알바 계정 생성 → 로그아웃 → 알바로 로그인 → 시나리오 선택 화면에서 **"음료 지연"·"품절 메뉴"·"커스텀 음료 요청" 3개 카드에 "기본" 배지가 실제로 렌더링되는 것을 스크린샷으로 확인**.
- 테스트로 만든 계정·매장은 확인 직후 Supabase DB에서 직접 삭제해 정리(feature-verifier·브라우저 테스트 둘 다).
- **확인 못 한 것**: 사장님이 실제로 커스텀 규칙을 제출·승인했을 때 기본 콘텐츠가 사라지고 커스텀으로 교체되는 전환은 `docs/rule-submission-transaction.md` 검증에서 실제 Gemini 호출로 확인함(이 문서와 같은 세션에서 함께 검증됨).

### 업종 확장 (카페 → 6개 전부)
- `server/src/lib/defaultScenarios.js`의 `DEFAULT_SCENARIOS`에 편의점·음식점·마트·PC방·뷰티 5개 업종 추가, 업종당 시나리오 3개(필수 2 + 선택 1) — 총 18개 시나리오.
- 테스트 1개 추가(`buildDefaultSeedData`가 6개 업종 전부 3개씩 반환하는지), 서버 테스트 110개 + lint 통과.
- curl로 `beauty` 업종 매장을 새로 만들어 `GET /me/training-scenarios`가 3개 전부 `isDefault:true`로 반환되는 것을 실제 확인(나머지 업종도 같은 코드 경로라 별도 확인 생략).

### 사장님용 "규칙 작성 예시"도 6개 업종으로 확장 (별개 기능, 같은 날 발견·수정)
`server/src/lib/defaultScenarios.js`(알바 훈련용, 위 내용)와는 별개로, `src/components/RulesInput.jsx`의 `INITIAL_RULES`(사장님이 규칙을 처음 쓸 때 참고하라고 채워주는 예시 카드 4개)는 카페 전용으로 남아 있었다. 이것 때문에 `IndustrySelect.jsx`가 카페 외 업종엔 "이 업종은 아직 준비된 예시가 없어요"를 계속 띄웠고(사용자가 "오류"로 오인해 발견), 실제로 RulesInput 화면도 업종과 무관하게 카페 카드 4개를 그대로 보여주고 있었다.

- `INITIAL_RULES` → `INITIAL_RULES_BY_INDUSTRY`(업종별 4개 카드)로 확장, `user?.store?.industry` 기준으로 선택.
- `IndustrySelect.jsx`의 `HINTS`를 6개 업종 전부로 채움(`DEFAULT_HINT`는 향후 업종 추가 대비 안전장치로 유지).
- **추가로 발견한 버그**: `RulesInput.jsx`의 부제("~에서 자주 나오는 상황...")와 업종 태그가 `카페에서 자주 나오는`으로 하드코딩돼 있어, 실제로는 다른 업종을 골라도 이 문구만 "카페"로 고정 표시됐다 — `industryLabel`/`industryIcon` 변수로 교체해 수정.
- 브라우저로 마트·PC방 업종 새 계정을 만들어 카드 내용·부제 문구가 각각 정확히 바뀌는 것을 실제 확인(PC방: "PC방·오락실에서 자주 나오는 상황 기준으로..." + 인사말/이용시간 안내/장비 문제 대응 카드).

이슈(`soyun11/hub#13`, 온보딩 가드) — 배너 방식 대신 이 기능으로 완전히 대체되어 콜드스타트 자체가 없어짐. 이슈는 코멘트 남기고 종료, `soyun11/hub#23`으로 대체.
