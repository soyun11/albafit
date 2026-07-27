# rule-submission-transaction.md — 규칙 제출 트랜잭션 묶기

> `docs/rubric-reuse.md`와 같은 방식으로 기록한다. 관련: `soyun11/hub#8`(핵심 기능 안정성 보강) 잔여 항목, `soyun11/hub#15`(4주차-1 골든 패스 확정).

## 왜 만들었나

`POST /:linkKey/rules`(`server/src/routes/stores.js`)는 규칙 원문을 `StoreRule`로 저장한 뒤, 제안된 시나리오 개수만큼 `Scenario`+`Rubric`을 `Promise.all`로 만든다. 이 여러 단계가 하나의 원자적 단위로 묶여있지 않아서, 중간(예: N번째 시나리오 생성 직전 DB 순간 장애)에 실패하면 `StoreRule`과 일부 `Scenario`만 DB에 남고 나머지는 비는 부분 데이터 상태가 될 수 있다. 골든 패스 초입(규칙 제출)에 있는 문제라 이번 주 우선 처리 대상으로 올렸다.

## 결정

| 논점 | 결정 | 이유 |
|---|---|---|
| 트랜잭션 범위 | **DB 쓰기(storeRule + scenario + rubric 생성)만** — AI 호출(`proposeScenarios`, `generateRubric`, 재사용 후보 조회)은 트랜잭션 밖 | LLM 호출은 시나리오당 20초 가까이 걸린다. 이걸 트랜잭션 안에 넣으면 그만큼 DB 커넥션을 오래 붙잡아두게 되어 다른 요청과 자원 경합이 커진다. `batch`(시나리오+루브릭 데이터)를 메모리에서 전부 완성한 뒤 트랜잭션을 여는 구조로 분리한다. |
| 로직 위치 | **`server/src/lib/ruleSubmission.js` 신규** — `submitRuleBatch(tx, params)` 순수 함수, AI lib을 import하지 않음 | AI lib을 아예 import 안 하는 파일 구조 자체가 "트랜잭션 안에 AI 호출이 섞일 수 없다"를 코드로 보장한다. 이 저장소에 라우트 핸들러 단위 테스트 선례가 없어서(전부 `server/src/lib/*.test.js` 순수 함수 + mock 패턴), 로직을 순수 함수로 뽑아야 테스트 가능하다. |
| DB 쓰기 순서 | storeRule 생성 → batch를 순회하며 scenario 생성 → 그 id로 rubric 생성 (순차) | 재사용 경로(`rubricReuse.js`)와 신규 생성 경로(`scenarioProposer.js`+`rubric.js`) 둘 다 이 함수 하나로 합쳐서 처리한다 — 두 경로가 "AI 호출로 batch 준비 → DB 쓰기"라는 같은 모양이 되기 때문. 트랜잭션 안 DB 쓰기는 이미 AI 호출이 다 끝난 뒤라 네트워크 지연이 없어, `Promise.all` 대신 순차 처리해도 체감 속도 차이가 거의 없고 코드가 더 단순하다. |
| 실패 시 동작 | `submitRuleBatch`가 reject되면 `prisma.$transaction`이 전체 롤백 | Prisma의 기본 트랜잭션 보장을 그대로 씀 — 별도 롤백 로직을 직접 짤 필요 없음. |

## 다음 단계

1. ~~설계 문서화 (이 문서)~~ — 완료
2. `server/src/lib/ruleSubmission.test.js`(RED 먼저) — storeRule-시나리오 연결, batch 개수만큼 생성, 중간 실패 시 전체 reject(핵심 케이스), 응답 형태, category/items 선택 처리
3. `server/src/lib/ruleSubmission.js` — `submitRuleBatch(tx, { storeId, rawText, category, items, batch })`
4. `server/src/routes/stores.js`의 `POST /:linkKey/rules` — 재사용/신규 두 경로 모두 "AI 호출로 batch 준비" 단계로 정리한 뒤, `prisma.$transaction(tx => submitRuleBatch(tx, ...))` 한 번으로 DB 쓰기
5. 서버 테스트 + 루트 lint
6. 브라우저/curl로 정상 흐름 1회 확인(강제 실패로 롤백 재현은 생략 — 2번 테스트가 이미 그 분기를 커버)

## 구현·검증

### 구현
- `server/src/lib/ruleSubmission.js`(신규) — `submitRuleBatch(tx, params)`. AI lib import 없음.
- `server/src/lib/ruleSubmission.test.js`(신규) — 6개 테스트(storeRule-scenario 연결, scenario-rubric 연결, batch 개수, **중간 실패 시 reject**, 응답 형태, category/items 선택), RED→GREEN.
- `server/src/routes/stores.js`의 `POST /:linkKey/rules` — 재사용 경로·신규 생성 경로 모두 DB 쓰기(`prisma.scenario.create`/`prisma.rubric.create`)를 없애고 `batch` 배열(메모리)만 준비하도록 재작성. 마지막에 `prisma.$transaction((tx) => submitRuleBatch(tx, { storeId, rawText, category, items, batch }))` 한 번으로 `storeRule` 생성부터 전체 DB 쓰기를 묶음.
- 서버 테스트 103개(신규 6개 포함) + 루트 lint 통과.

### 검증
- 단위 테스트로 "시나리오 생성 중 하나가 실패하면 전체가 reject된다"(롤백을 보장하는 핵심 지점)를 확인 — 실제 DB 강제 실패 재현은 하지 않음(비용 대비 실익 낮음, `docs/rubric-reuse.md` 검증 때와 같은 판단).
- **feature-verifier 에이전트로 실제 Gemini 호출을 거친 정상 흐름 검증**: 카페 매장에서 실제 규칙(환불/유통기한/흡연) 제출 → `201`, 응답이 `{storeRule, rubrics: [3개]}` 기존 스키마 그대로임을 실제 호출로 확인(코드 리뷰가 아니라 실행 결과로 확인).
- **기본 매뉴얼과의 전환 확인**(`docs/default-manual-scenarios.md`의 "알려진 한계" 재현): 커스텀 규칙 제출 직후(승인 전) `GET /me/training-scenarios` → `{"scenarios":[]}`(기본 3개도 함께 사라짐, 설계대로). 새 루브릭 3개 전부 승인 후 다시 조회 → 커스텀 시나리오 3개가 `isDefault:false`로 정상 노출, 기본은 사라짐.
- 테스트로 만든 계정·매장·규칙은 확인 직후 Supabase DB에서 직접 삭제해 정리.
