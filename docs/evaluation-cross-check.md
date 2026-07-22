# evaluation-cross-check.md — 평가 결과 교차검증 (기능 강화②)

> `docs/rubric-reuse.md`와 같은 방식으로 기록한다. 관련 이슈: `soyun11/hub#5`. 근거: `docs/backlog.md` 6절·8절, `docs/checklist.md` 3주차 7/21~7/22 섹션.

## 왜 만들었나

평가 에이전트(`server/src/lib/evaluator.js`, Gemini)는 이 서비스에서 할루시네이션 리스크가 가장 큰 지점이다. 현재 방어막은 세 겹이다 — (1) 닫힌 루브릭으로만 채점하게 강제, (2) JSON 스키마 강제, (3) `missingCriteria`는 LLM 판단이 아니라 코드로 재계산. 하지만 이 세 겹 다 "Gemini가 애초에 이 항목을 met/unmet으로 잘못 판단했는지"는 잡아내지 못한다 — 그건 사람이 직접 봐야만 안다(같은 날 진행하는 캘리브레이션, `soyun11/hub#6`).

교차검증의 역할은 **정답을 정하는 것이 아니라 "이 판정은 다시 볼 필요가 있을 수도 있다"는 신호를 자동으로 뽑아내는 것**이다. 서로 독립된 두 모델(Gemini/OpenAI)이 같은 루브릭·같은 답변을 보고 다르게 판단했다면, 그 항목은 루브릭 문구가 애매하거나, 답변이 경계선에 있거나, 한쪽이 틀렸다는 뜻이다 — 이게 캘리브레이션(#6, "오답 케이스 모아 루브릭·프롬프트 다듬기")에 쓸 원재료가 된다. 즉 오늘 만드는 두 기능(교차검증 + 캘리브레이션)은 서로의 재료를 공급하는 관계다.

완료 기준(이슈 그대로): **같은 답변에 대해 두 모델의 채점 결과를 비교할 수 있고, 불일치 시 로그로 남는다.**

구현 전 `task-planner` 에이전트로 작업을 쪼개 검토했고, 그 결과 나온 결정 중 핵심 두 가지(로그만 남길지 판정에 반영할지, 어느 턴에 적용할지)를 사용자가 확정했다 — 아래 "결정" 표에 반영.

## 결정

| 논점 | 결정 | 이유 |
|---|---|---|
| 어떤 모델로 재검증하나 | **OpenAI `gpt-4o-mini` 재사용** (새 벤더 추가 안 함) | CLAUDE.md "OpenAI+Gemini 두 벤더만 쓴다" 제약. 이미 `server/src/lib/openai.js`에 클라이언트가 있어 구현 난이도·비용 둘 다 최소. Gemini와 벤더 자체가 다르니 "타 모델 재검증" 취지에 맞는다. |
| 기존 평가 호출과 합치나 | **아니오 — 완전히 분리된 모듈(`evaluatorCrossCheck.js`)에서 별도 호출** | CLAUDE.md "손님/평가 에이전트는 한 호출로 합치지 않는다" 원칙을 교차검증에도 동일 적용. |
| 불일치 판단 기준 | 루브릭 `criteria`의 각 item을 기준으로, Gemini `metItems`와 OpenAI `metItems`의 `met` 값이 하나라도 다르면 그 항목을 불일치로 본다. 비교는 순수 함수(코드)로 하고 어느 쪽 LLM 출력도 그대로 신뢰하지 않는다 | `evaluator.js`가 이미 "missingCriteria는 LLM이 아니라 코드로 재계산"하는 원칙을 갖고 있다 — 교차검증 비교 로직도 같은 원칙(비교 자체는 결정론적 코드). |
| 동기 vs 비동기 | **비동기(fire-and-forget)** — 턴 응답(`res.json`)은 기존 Gemini 채점 결과만으로 그대로 나가고, OpenAI 교차검증 호출은 응답을 기다리지 않고 백그라운드에서 실행 후 결과만 로그로 남긴다 | 이슈 완료 기준이 "비교·로그"이지 "교차검증 결과로 턴 통과 여부를 바꾼다"가 아니다. 알바가 기다리는 실시간 턴 루프에 두 번째 LLM 호출 지연을 얹으면 안 된다. |
| 턴 통과/재입력 판정에 영향 주나 | **아니오 — 절대 영향 없음.** `retryNeeded`/`passed`/하트 계산은 지금처럼 Gemini 채점 결과로만 결정한다 | 이슈 자체가 "검증"이지 "판정 로직 교체"가 아니다. 두 모델 중 뭐가 맞는지 자동으로 확정할 근거가 없어 임의로 하나를 우선시키면 새로운 오판 리스크가 생긴다. |
| 어느 턴에 적용하나 (통과 턴 포함 vs 재입력 턴만) | **모든 턴 — 통과/재입력 무관하게 매번 크로스체크** | 재입력 턴만 검사하면 "Gemini가 통과라고 했지만 사실 필수 기준을 놓친" false pass는 절대 못 잡는다. 알바에게 실제로 영향을 주는 건 놓치는 것보다 여분 호출 비용이 싸다 — 4주 챌린지 데모 규모라 턴당 호출이 하나 늘어도(손님 1 + 평가 1 + 교차검증 1 = 3회) 비용은 무시할 만하다. 프로덕션 규모에서 상시로 켤지는 4주차 "LLM 호출 지점 재검토"(`docs/backlog.md`)에서 다시 본다. |
| 결과를 어디에 남기나 | **DB 컬럼 추가 없이 콘솔 로그만** — 불일치 없으면 `console.log`, 있으면 `console.warn`으로 구분 | 로깅 인프라가 아직 없고(`console.error`뿐, 구조화 로깅은 checklist.md 7/23 별도 백로그), 지금 스코프에서 과설계하지 않는다. `SessionTurn.evaluation`에 검증 필드를 얹으면 스키마 변경(`schema.prisma`+`db-schema.md` 동시 수정, 마이그레이션)까지 필요해져 스코프가 커진다. |
| 실패(OpenAI 호출 에러 등) 처리 | **재시도 없이 에러를 잡아 로그만 남기고 격리** — 턴 응답·세션 흐름에 전혀 영향 없음 | "AI 호출 재시도 로직"은 checklist.md 7/23 몫으로 이미 따로 있다. 여기서 필요한 건 실패가 메인 흐름에 전파되지 않는 것뿐. |

## 다음 단계 (TDD로 순서대로 진행)

`task-planner` 리뷰에서 나온 우선순위 그대로:

1. ~~설계 결정 문서화 (이 문서)~~ — 완료
2. 순수 비교 함수 (`server/src/lib/evaluatorCrossCheck.js`) — `compareMetItems`/`findMismatches`, 테스트 먼저(`test-writer` 스킬 단위 테스트 패턴)
3. 두 번째 모델 호출 함수 — `crossCheckEvaluateTurn` (OpenAI `gpt-4o-mini`), `openai.js` mock으로 테스트 먼저
4. 로깅 함수 — `logCrossCheckResult`, console spy로 가벼운 테스트
5. `server/src/routes/sessions.js`의 `POST /:id/turns`에 연결 — `sessionTurn.create` 이후, `res.json` 이전에 await 없이 호출 + `.catch`로 실패 격리
6. 통합 수동 확인 — 로컬 서버로 턴 제출, 콘솔에 두 모델 결과가 나란히 찍히는지·불일치 시 `console.warn`이 남는지·턴 응답이 지연 없이 오는지 확인 (`feature-verifier`로 응답 시간 비교)

7(라우트 통합 테스트)·8(OpenAI 실패 격리 테스트)은 "여유" 등급이라 시간이 부족하면 가장 먼저 미룬다 — 1~6번만으로 이슈의 완료 기준은 충족된다.

## 구현·검증

### 순수 함수 + OpenAI 호출 + 로깅 (`server/src/lib/evaluatorCrossCheck.js`)
- `compareMetItems(criteria, metItemsA, metItemsB)` — 루브릭 item별로 두 모델의 `met` 값을 비교, 하나라도 다르면 `mismatch: true`. 한쪽 met_items에 항목이 없으면 `met: false`로 취급(evaluator.js의 missingCriteria 계산과 동일 원칙), `[필수]/[선택] ` 접두어 echo 버그도 동일하게 방어.
- `findMismatches(comparison)` — mismatch만 필터.
- `crossCheckEvaluateTurn({ criteria, customerMessage, staffAnswer })` — OpenAI `gpt-4o-mini` + `response_format: json_schema`(strict)로 `{met_items: [{item, met}]}` 강제.
- `logCrossCheckResult({ turnId, comparison, mismatches })` — 불일치 없으면 `console.log`, 있으면 `console.warn`.
- `runCrossCheck({ turnId, criteria, customerMessage, staffAnswer, geminiMetItems })` — 위 셋을 묶은 진입점, 라우트에서 fire-and-forget으로 호출.
- 테스트 12개(`evaluatorCrossCheck.test.js`) — 순수 함수는 mock 없이, `crossCheckEvaluateTurn`은 `openai.js` mock, `logCrossCheckResult`는 console spy (`test-writer` 스킬 패턴). 전부 통과, TDD로 테스트 먼저 작성 후 구현.

### 라우트 연결 (`server/src/routes/sessions.js`)
`POST /:id/turns`에서 `prisma.sessionTurn.create(...)` 직후, 응답을 만들기 전에 `runCrossCheck(...)`를 **await 없이** 호출하고 `.catch(err => console.error('[cross-check] failed', err))`로 실패를 격리.

전체 서버 테스트(46개) + 루트 lint 통과.

### 통합 검증 (`feature-verifier` 에이전트, 실제 서버·Supabase DB, 기존 승인 루브릭 재사용해 신규 매장/루브릭 생성 없이 진행)
- 정상 답변 제출: 턴 응답은 Gemini 채점만으로 7.01초 만에 도착(201/`passed`), 이후 서버 로그에 `[cross-check] turn <id>: 일치 (2개 항목 모두 동일)`가 응답보다 늦게(비동기) 찍힘 — fire-and-forget이 실제로 응답을 지연시키지 않음을 확인.
- 재입력(미통과) 턴 제출: 크로스체크가 통과 턴뿐 아니라 재입력 턴에도 정상 동작함을 확인.
- `OPENAI_API_KEY`를 의도적으로 잘못된 값으로 바꾼 뒤 제출: 턴 응답은 정상(201/`passed:true`)으로 그대로 오고, 서버 로그에 `[cross-check] failed AuthenticationError: 401 ...`만 남음 — 실패가 메인 흐름에 전혀 전파되지 않는 격리 동작 확인. 검증 후 `.env` 원복.
- **확인 못 한 것**: `console.warn`(불일치) 로그 경로 — 실제 호출 3회 모두 Gemini/OpenAI가 같은 항목에 동일하게 판정해 disagreement를 재현하지 못함. `compareMetItems`/`findMismatches` 비교 로직 자체는 단위 테스트 12개로 이미 검증됨 — 확인 못 한 건 "실전에서 두 모델이 실제로 갈리는 빈도"뿐. Gemini 무료 티어 호출 한도 절약을 위해 추가 시도는 하지 않음.
- 버그 발견: 없음.

이슈(`soyun11/hub#5`)의 완료 기준 — "같은 답변에 대해 두 모델의 채점 결과를 비교할 수 있고, 불일치 시 로그로 남는다" — 비교·로그 남기는 코드 경로와 정상 동작은 확인됨. 불일치 로그가 실제로 찍히는 건 코드 레벨(단위 테스트)로만 확인, 실서비스 트래픽에서 자연 발생하는 불일치는 캘리브레이션(`soyun11/hub#6`) 과정에서 누적되며 추가로 관찰될 것으로 본다.
