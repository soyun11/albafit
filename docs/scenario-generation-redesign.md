# scenario-generation-redesign.md — 시나리오를 "업종별 고정 3개"에서 "매장 규칙 기반 AI 제안"으로 전환

> 설계만 끝난 상태. **구현은 다음 세션에서 시작.** `docs/rubric-reset-flow.md`, `docs/staff-report-and-rubric-fix.md`와 같은 방식으로 기록해둔다.

## Context

지금은 업종마다 시나리오가 3개로 못박혀 있다(`server/src/lib/industryScenarios.js`의 `INDUSTRY_SCENARIOS` — 카페는 `delay`/`out_of_stock`/`rule_violation` 고정). 사장님이 어떤 규칙을 적든 이 3개 틀에 억지로 끼워맞춰서 채점표를 만든다.

오늘 실제로 문제가 드러났다 — 데모 계정에 "테이크아웃 컵 리드 제공" 같은 규칙을 추가해도 "음료 지연" 시나리오엔 온전히 안 어울려서 채점표가 빈약했고(1턴째부터 "손님 나갈 때 인사"만 힌트로 뜨는 등 어색함), "음료 제조법"처럼 3개 틀 어디에도 안 맞는 규칙은 아예 훈련에 반영될 방법이 없다. 랜딩페이지가 내세우는 "일반 매뉴얼이 아니라 우리 매장 기준으로"라는 정체성과도 안 맞는 부분.

**방향 전환**: 사장님이 규칙을 제출하면, 그 규칙 내용을 보고 AI가 실제로 훈련할 만한 상황(시나리오) N개를 직접 제안하고, 각 상황의 채점 기준을 같이 만든다. 시나리오 자체도 AI 생성물이므로 "AI는 생성, 사장님은 승인" 원칙(CLAUDE.md)에 따라 루브릭과 같이 한 화면에서 승인한다.

**체험하기(비회원, `GuestTry.jsx`/`guest.js`)는 이번 범위에서 제외** — 지금의 업종별 고정 3개 시스템을 그대로 둔다(사용자 확인 완료). 비회원은 매장 없이 업종만 고르고 바로 맛보는 게 목적이라, 규칙 하나 적었다고 AI가 시나리오를 새로 제안하는 흐름보다 "업종 고르고 바로 시작"이 더 낫다고 판단.

## 설계

### 1. DB 스키마 — `Scenario`에 `storeRuleId` 추가 (마이그레이션 필요)

재설정을 여러 번 하면 매번 다른 시나리오가 제안될 수 있어서, "이번에 새로 만든 시나리오 묶음"과 "예전에 만들었던 시나리오"를 구분해야 한다 — 안 그러면 오늘 고친 store_rules 중복 누적 버그와 똑같은 문제가 시나리오 레벨에서 다시 생긴다. 그렇다고 예전 `Scenario` row를 지우면 안 된다(`onDelete: Cascade`로 연결된 과거 `TrainingSession`·`Rubric`까지 같이 날아가서 리포트 히스토리가 깨진다).

- `Scenario`에 `storeRuleId String? @db.Uuid` + `StoreRule storeRule?` 관계 추가(nullable — 과거 데이터는 없음).
- 매번 규칙을 (재)제출할 때마다 **기존 `Scenario` row를 재사용하지 않고 항상 새로 생성**, 방금 만든 `StoreRule.id`를 `storeRuleId`로 채운다.
- "지금 이 매장의 현재 시나리오"를 조회하는 모든 곳은 `storeId` + `storeRuleId === 이 매장의 최신 StoreRule.id` 조건으로 필터링한다. 예전 시나리오·거기 딸린 세션·루브릭은 DB에 그대로 남아있지만 "현재 목록"엔 안 뜬다.
- `Scenario.type` 컬럼은 유지하되(NOT NULL 제약 때문에 값은 필요) 더 이상 조회 키로 안 쓴다 — 대신 `Scenario.id`(UUID)를 조회 키로 쓴다(4절). `type`엔 `scenario-1`처럼 그냥 순번만 채운다.
- `Scenario.persona`(기존에 있던 미사용 JSON 컬럼, `{}`로 방치돼있던 것)에 `{ situation, opening }`을 실제로 채워 쓴다 — 새 컬럼 추가 없이 이미 있던 자리를 채우는 것. (`persona`/`initialState`가 애초에 "나중에 채울 자리"라는 주석과 함께 비어있었다 — 원래 설계가 이 방향을 염두에 뒀던 흔적으로 보임.)
- `docs/db-schema.md`도 같이 갱신.

### 2. 시나리오 제안 — 신규 `server/src/lib/scenarioProposer.js`

`rubric.js`의 `generateRubric()`과 같은 패턴(Gemini + `responseSchema`로 JSON 강제)으로 새 함수 하나 추가:

```
proposeScenarios({ rawRulesText, industry }) → Promise<Array<{ title, situation, opening }>>
```

- 프롬프트: "이 매장 규정을 읽고, 실전 훈련에 쓸 만한 서로 다른 상황을 3~5개 뽑아라. 규정에 없는 상황을 억지로 지어내지 마라(단, 업종 통념 수준의 상황 설정은 허용). 각 상황마다 짧은 제목(title), 그 상황이 정확히 어떤 순간인지 한 줄 설명(situation), 손님이 처음 건넬 만한 대사 한 줄(opening)을 만들어라." — `generateRubric`의 "규정에 없는 내용은 지어내지 않는다" 원칙을 그대로 계승.
- 안전장치: 응답이 0개면 명확한 에러로 실패 처리(빈 상태로 진행 안 함), 서버에서 최대 6개로 슬라이스(폭주 방지).

### 3. 규칙 제출 라우트 재작성 — `server/src/routes/stores.js`의 `POST /:linkKey/rules`

현재 `INDUSTRY_SCENARIOS[store.industry]`를 순회하며 `generateRubric()`을 3번 호출하는 블록을 다음으로 교체:

1. `proposeScenarios({ rawRulesText: combinedRulesText, industry: store.industry })` 한 번 호출 → 제안된 상황 배열.
2. 제안된 상황마다: `Scenario.create({ storeId, type: \`scenario-${i+1}\`, title, persona: { situation, opening }, initialState: {}, storeRuleId: storeRule.id })`로 **항상 새로** 만든다(기존처럼 `findFirst`로 재사용 안 함 — 매번 새 batch).
3. 그 시나리오에 대해 기존 `generateRubric({ scenarioType, scenarioTitle: title, situation, rawRulesText: combinedRulesText })` 그대로 호출(이 함수는 안 바뀜) → `Rubric.create({ scenarioId, criteria, version: 1, approvedAt: null })`(항상 새 `Scenario`라 버전 조회·bump 로직 필요 없어짐 — 단순해짐).
4. 응답 형태: `{ storeRule, rubrics: [{ ...rubric, scenarioId, scenarioTitle, situation, opening }] }` — 프론트가 시나리오 메타(상황·오프닝)까지 같이 받도록 필드 추가.

`INDUSTRY_SCENARIOS` import는 이 파일에서 제거(더 이상 안 씀 — `guest.js`는 계속 씀, `industryScenarios.js` 파일 자체는 안 건드림).

### 4. 훈련 시작 — `server/src/routes/sessions.js`

- `POST /`: body를 `{ scenarioType, staffLabel }`에서 `{ scenarioId, staffLabel }`로 변경. 조회를 `findFirst({ storeId, type })` 대신 `findUnique({ where: { id: scenarioId } })` + `scenario.storeId === req.user.storeId` 소유권 확인으로 교체(다른 매장 시나리오 id를 남이 넣는 걸 막음).
- `getOpeningLine(scenario.type)` 호출을 `customerAgent.js`의 새 함수(5절)로 교체.
- `POST /:id/turns`: `getCustomerReply({ scenarioType: session.scenario.type, ... })`를 새 함수로 교체, `session.scenario.persona.situation`을 직접 넘김.

### 5. `server/src/lib/customerAgent.js` — 기존 함수는 그대로 두고 새 함수 추가

`guest.js`는 여전히 고정 `SCENARIOS` 맵 + 기존 `getOpeningLine(scenarioType)`/`getCustomerReply({scenarioType,...})`를 쓰므로 **건드리지 않는다**. 대신 실제 매장용 새 함수를 추가:

- `getOpeningLineForScenario(scenario)` — `scenario.persona?.opening` 반환.
- `getCustomerReplyForScenario({ situation, criteria, history })` — 기존 `buildSystemPrompt`가 `SCENARIOS[scenarioType]`에서 situation을 찾던 부분을 파라미터로 직접 받게 살짝 리팩터(내부 프롬프트 조립 로직은 재사용, 조회 부분만 분리).

### 6. 프론트 — 시나리오 목록 조회 API 신규 + 화면 연결

- 신규 `GET /api/stores/me/training-scenarios` (`stores.js`, `requireAuth`만 — 알바도 호출해야 하므로 `requireRole('owner')` 없음): 로그인한 사용자의 매장의 **최신 storeRuleId 배치** 중 승인된(`Rubric.approvedAt` not null) 시나리오만 `[{ id, title, situation }]`로 반환.
- `ScenarioSelect.jsx`: `src/lib/industries.js`의 정적 `INDUSTRY_SCENARIOS` import 제거, `useEffect`로 위 API 호출해서 카드 렌더링. `onNext(scenario.id)`로 변경(기존 `scenario.key` 대신).
- `App.jsx`: `selectedScenario`가 이제 시나리오 id를 담음 — 구조는 안 바뀜, 값 의미만 바뀜. `TrainingSession.jsx`가 `POST /api/sessions` 보낼 때 `scenarioId`로 필드명 변경.
- `RubricApproval.jsx`: 각 탭 상단에 `situation`/`opening`을 짧게 보여주는 블록 추가(예: "손님이 이렇게 시작해요: '...'") — 루브릭 승인과 같은 클릭으로 시나리오 자체도 같이 승인되는 셈이라 별도 승인 UI는 안 만든다.
- `RulesInput.jsx`: `onNext(data.rubrics)` 호출부는 그대로, 다만 각 rubric 객체에 `scenarioId`/`situation`/`opening`이 추가로 실려온다는 점만 인지(구조 변경 없음).

### 7. 대시보드/리포트 쪽 영향 확인

오늘 만든 `GET /me/staff-report`의 `totalScenarioTypes`(진행률 분모)는 이미 `prisma.scenario.findMany({ where: { storeId } })`로 **DB에서 동적으로** 세고 있어서, 개수가 3이 아니어도 코드 변경 없이 잘 동작한다. 다만 여기도 "최신 storeRuleId 배치만" 세도록 필터를 추가해야 한다(안 그러면 재설정을 여러 번 한 매장은 과거 시나리오까지 다 세어져 분모가 계속 불어난다) — 3절의 `storeRuleId` 필터를 이 쿼리에도 동일하게 적용.

## 오늘 범위 밖 (명시적 제외)
- 체험하기(`guest.js`, `GuestTry.jsx`) — 고정 3개 시스템 그대로 유지.
- `server/eval/rubric-eval-set.json` 회귀 테스트 — 지금은 고정 `scenarioType`/`scenarioTitle` 쌍을 테스트하는데, `proposeScenarios()`용 회귀 세트는 이번엔 안 만든다(기존 `generateRubric()` eval은 그대로 유효, 안 건드림).
- 기존에 이미 만들어진 시나리오(데모 계정의 delay/out_of_stock/rule_violation 등, `storeRuleId: null`)에 대한 소급 마이그레이션 — 그대로 두면 "최신 배치 아님"으로 자동으로 안 보이게 됨, 별도 처리 불필요.

## 핵심 파일
- `server/prisma/schema.prisma`, `docs/db-schema.md` (스키마: `Scenario.storeRuleId`)
- `server/src/lib/scenarioProposer.js` (신규)
- `server/src/lib/customerAgent.js` (함수 추가, 기존 함수 안 건드림)
- `server/src/routes/stores.js` (`POST /:linkKey/rules` 재작성, `GET /me/training-scenarios` 신규, `GET /me/staff-report`의 시나리오 카운트 필터 추가)
- `server/src/routes/sessions.js` (`scenarioType` → `scenarioId`)
- `src/components/ScenarioSelect.jsx`, `src/components/RubricApproval.jsx`, `src/components/TrainingSession.jsx`, `src/App.jsx`

## 검증 (내일 구현 후 확인할 것)
- 데모 계정으로 "기준 재설정" → 규칙 그대로 재제출 → 이번엔 AI가 제안한 시나리오 제목·상황·오프닝이 뜨는지, 예전 3개(음료지연/품절/규칙위반)와 다르게(또는 더 잘 맞게) 나오는지 확인.
- 승인 후 알바로 로그인 → 시나리오 선택 화면이 새로 제안된 시나리오들로 뜨는지, 하나 골라 실제 대화 시작까지 되는지 확인.
- 대시보드/리포트의 "진행률(N/M)"이 새 시나리오 개수 기준으로 정상 계산되는지 확인(과거 시나리오가 분모에 안 섞이는지).
- 체험하기(로그아웃 상태)는 기존과 동일하게 동작하는지(회귀 없는지) 확인.
- `npm run lint` 통과, `npx prisma migrate dev` 정상 적용.

---

# (별개 TODO, 내일) 평가 피드백 문구가 "이미 충족된 기준"을 다시 지적하는 문제

## 발견 경위
훈련 화면 스크린샷을 보다가 발견 — 1턴에서 "죄송합니다"로 사과 기준을 이미 충족했는데, 2턴 피드백 문구가 "사과를 먼저 하지 않은 점이 아쉽습니다"라고 지적했다. 우측 체크리스트는 "기준 충족 2/2"로 정확했지만(한 번이라도 충족하면 계속 충족 상태 유지 — `TrainingSession.jsx`), 그 옆 피드백 텍스트가 마치 모순되는 것처럼 보여서 헷갈렸다.

## 원인
`server/src/lib/evaluator.js`의 `evaluateTurn()`이 **이전 턴 맥락 없이 이번 턴(customerMessage+staffAnswer) 하나만** 보고 `feedback`을 쓴다. `server/src/routes/sessions.js`의 `POST /:id/turns`가 `evaluateTurn`을 부를 때 이전 턴 정보를 아예 안 넘겨준다. 그래서 "이번 답변에 사과가 없다"는 것 자체는 사실이라 피드백으로썬 틀린 말이 아니지만, 이미 충족된 기준까지 다시 지적하는 게 문제.

## 결정 — 무엇을 바꾸고 무엇을 안 바꾸는지
- **`met_items`(JSON, 기준별 충족여부)는 안 건드린다** — 체크리스트가 이걸로 계산하는데, "이번 답변만 보고 판단"하는 게 정확하고 맞다.
- **`feedback`(자유 텍스트)만 고친다** — 이미 충족된 기준을 이번 턴에서 안 지켰다고 깎아내리지 않도록.

## 구현 계획
1. `sessions.js`의 `POST /:id/turns`에서, 체크리스트가 쓰는 것과 같은 방식으로 "이전 턴까지 이미 충족된 기준 목록"을 `session.sessionTurns`에서 계산.
2. `evaluateTurn()`에 새 파라미터(예: `alreadyMetItems`)로 그 목록을 넘김.
3. `evaluator.js` 프롬프트에 지침 추가: "다음 기준은 이전 턴에서 이미 충족됨: [...]. `met_items` 판정은 이번 답변만 보고 그대로 판단하되, `feedback`을 쓸 때 이미 충족된 기준을 이번 답변에서 안 지켰다고 지적하지 말고 언급을 빼거나 짧게만 확인해줘."

## 검증 (내일)
- 데모 계정으로 훈련 하나 진행 — 1턴에서 기준 A만 충족, 2턴에서 기준 B만 충족시키는 답변을 일부러 보내서, 2턴 피드백이 "A를 안 지켰다"고 지적하지 않는지 확인.
- 기존 체크리스트(met_items 기반) 계산은 그대로 정확한지 회귀 확인.

---

# (별개 TODO, 내일) "원문 안 지우고 최신 것만 쓰는" 패턴의 한계

## 지금 쓰고 있는 패턴
`store_rules`(규칙 원문), `rubrics`(채점 기준) 둘 다 같은 방식이다 — 수정할 때마다 기존 row를 `UPDATE`하지 않고 매번 새 row를 `INSERT`만 하고, 조회할 땐 `orderBy: { createdAt/version: 'desc' }` + `findFirst`로 제일 최근 것 하나만 꺼내 쓴다. `is_active` 같은 명시적 상태 컬럼은 없다.

## 오늘 대화 중 발견한 한계 (사용자 지적)
1. **"감사용으로 보존한다"고 설명했지만, 실제로 그 이력을 조회하는 화면·API가 하나도 없다.** 지금은 DB에 row가 쌓이기만 하고 아무도 안 읽는다 — "감사 목적"이라는 말이 아직 실제 기능이 아니라 잠재력에 가깝다.
2. **테이블이 무한정 커진다.** 사장님이 규칙을 자주 고칠수록 `store_rules`에 안 쓰이는 과거 row가 계속 쌓인다. 정리(아카이빙/삭제) 로직이 없다.
3. **"최신"의 기준이 `createdAt` 타임스탬프뿐이라 동시성에 취약하다.** 거의 동시에 두 번 저장하면(예: 네트워크 지연으로 사용자가 확정하기를 두 번 누름) 밀리초 단위 타이밍으로 어떤 게 "최신"이 될지 결정된다 — 사용자가 의도한 것과 다른 게 반영될 수 있다.

## 내일 검토할 방향 (아직 하나로 확정 안 함 — 논의 필요)
- `is_active`(또는 `is_current`) boolean 컬럼을 추가해서, 새 row를 저장하는 시점에 명시적으로 "이전 것 false, 새 것 true"로 바꾸는 방식 — 타이밍 의존성을 없앨 수 있다.
- 규칙/루브릭 변경 이력을 실제로 보여주는 화면(또는 최소한 API)을 만들어서 "감사용 보존"이라는 설명을 실제 기능으로 완성한다.
- 오래된 row를 일정 기준(개수 또는 기간)으로 아카이빙하거나 정리하는 배치 작업 검토.

## 우선순위
스키마·핵심 로직 변경 없이 "지금 상태를 정직하게 문서화"해두는 정도의 우선순위 — 시나리오 재구성(1번 TODO), 피드백 문구 수정(2번 TODO)보다는 급하지 않다. 다만 내일 시나리오 재구성 작업에서 `Scenario.storeRuleId`를 추가할 때 이 패턴을 또 그대로 반복하게 되므로, 그 전에 한 번은 짚고 넘어가는 게 좋다.
