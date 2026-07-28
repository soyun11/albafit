# multi-turn-conversation-fix.md — 손님이 다음 대사를 안 하던 버그 수정

> `docs/rubric-reuse.md`와 같은 방식으로 기록한다. 2026-07-27 대화에서 발견·수정.

## 무슨 버그였나

`server/src/routes/sessions.js`의 턴 진행 로직이 다음 두 조건을 같은 기준(전체 필수 기준 충족 여부)으로 계산하고 있었다:

- `retryNeeded`(재입력 필요) = `!evaluation.passed`, 여기서 `evaluation.passed`(`evaluator.js`)는 **"이번 답 하나가 루브릭의 필수 기준을 전부 충족했는가"**
- `allCriteriaMet`(세션 완료) = 세션 전체에서 필수 기준을 다 채웠는가 — 역시 같은 필수 기준 집합 기준

이 답 하나가 "통과"(`passed: true`)하는 순간 이미 전체 필수 기준을 다 채운 것이므로 `allCriteriaMet`도 항상 동시에 `true`가 되고, 그러면 세션이 그 자리에서 즉시 `completed`로 끝난다. 반대로 "통과"를 못 하면 `retryNeeded: true`가 되어 같은 질문에 계속 재입력만 반복한다. 즉 **"이번 턴은 통과했지만 세션은 아직 안 끝난" 상태가 코드상 존재할 수 없었다** — `nextCustomerMessage = await getCustomerReplyForScenario(...)`를 호출하는 분기(다음 손님 대사 생성)는 항상 건너뛰어지는 죽은 코드였다.

브라우저로 두 번 재현해서 확인(테스트 계정으로 실행 후 정리): 어떤 시나리오든 결국 "오프닝 한 줄 + 알바가 재입력을 반복한 답변들"로 끝났고, 손님이 진짜로 새 대사를 한 적은 한 번도 없었다.

## 결정

| 논점 | 결정 | 이유 |
|---|---|---|
| 재입력 판정 기준 | `evaluation.passed`(이 답 하나가 전체 필수 기준을 커버했는가) 대신 **`madeProgress`**(이 답이 이전에 없던 기준을 하나라도 새로 채웠는가)로 바꾼다 | 하트 차감 로직(`sessionTurns.js`의 `countOffTopicAttempts`)이 이미 이 개념("새로 충족시킨 기준이 있으면 진전")을 쓰고 있다 — 재입력 판정도 같은 기준으로 맞추는 게 일관적이고, 실제로 "엉뚱한 답만 재입력시키고 부분 진전은 다음으로 넘긴다"는 하트 힌트 문구("새로 채운 기준이 하나라도 있으면 하트가 안 줄어요")와도 맞아떨어진다 |
| 분리 방식 | 판정 로직을 `decideTurnOutcome()` 순수 함수로 뽑아 `sessionTurns.js`에 추가하고 단위 테스트로 커버(TDD RED→GREEN) | 이번 버그 자체가 "여러 조건이 얽힌 분기를 라우트 핸들러 안에서 눈으로 검증하기 어려웠던" 데서 나왔다. 순수 함수로 빼면 DB·AI 호출 없이 모든 케이스(하트 소진/무진전/부분 진전/완전 충족/턴 한도 도달)를 표로 테스트할 수 있다 |
| DB에 저장하는 `SessionTurn.passed` | `evaluation.passed`(정적 완전성) 대신 **`madeProgress`**(`!retryNeeded`)를 저장한다 | 다음 요청의 `isRetry` 판정(`lastTurn.passed === false`)이 이 저장값을 그대로 쓴다. 재입력 기준을 바꿨는데 저장값은 안 바꾸면, 프론트는 "다음 턴으로 넘어갔다"고 표시하는데 서버는 다음 요청을 "같은 턴 재입력"으로 오판해 방금 보여준 새 손님 메시지를 무시하고 예전 질문으로 덮어써버리는 불일치가 생긴다 |
| `evaluator.js`의 `passed` 필드 자체 | 안 건드림 — "이 답 하나가 전체 필수 기준을 커버했는가"라는 정의 그대로 유지 | 그 자체로 유효한 정보(예: 한 번에 다 맞춘 답인지)라 삭제할 이유가 없다. `sessions.js`가 이 필드를 턴 진행 판단에 쓰지 않게 되는 것뿐 |
| 프론트 피드백 말풍선 톤 | `data.evaluation.passed` 대신 **`!data.retryNeeded`**로 approve/confused를 결정하도록 `TrainingSession.jsx` 수정 | 부분 진전으로 다음 손님 질문으로 넘어가는 경우에도 기존 로직은 "confused"(안 풀린 표정)로 보여줬다 — 실제론 잘 진행되고 있는데 오해를 준다. 재입력이 필요할 때만 confused를 보여주는 게 맞다 |
| `MAX_TURNS`/AI 손님 재질문 로직 자체 | 안 건드림 | 이미 `getCustomerReplyForScenario`(손님 에이전트)는 history와 criteria를 받아 "안내 안 된 부분을 자연스럽게 캐묻는" 프롬프트로 잘 설계돼 있었다 — 실행될 기회가 없었을 뿐이라 그대로 재사용한다 |

## 구현

1. `server/src/lib/sessionTurns.js` — `decideTurnOutcome({ madeProgress, everMetItems, requiredItems, turnNumber, maxTurns, heartsExhausted })` 추가.
2. `server/src/lib/sessionTurns.test.js` — 5개 케이스(하트 소진/무진전 재입력/부분 진전 시 다음 턴/전체 충족 시 완료/턴 한도 도달 시 강제 완료) RED → GREEN.
3. `server/src/routes/sessions.js` — `priorMetItems`(이 턴 이전까지 확정된 met 기준) 계산 → `madeProgress` 계산 → `SessionTurn.create`의 `passed`에 `evaluation.passed` 대신 `madeProgress` 저장 → `decideTurnOutcome()` 호출로 `retryNeeded`/`completed`/`allCriteriaMet` 결정.
4. `src/components/TrainingSession.jsx` — 피드백 타입 결정을 `data.evaluation.passed` → 고정 `'approve'`로 변경(이 분기에 들어왔다는 건 이미 `retryNeeded`가 false로 확인된 뒤이므로 항상 진전이 있었던 경우다).
5. 서버 테스트 115개(신규 5개 포함) + 루트 lint 재확인 통과.

## 검증 (브라우저 실제 클릭, claude-in-chrome)

테스트 계정을 새로 만들어(사장님 회원가입 → 매장 생성 → 알바 계정 생성) 실제로 로그인해 "음료 지연" 시나리오를 진행:
- 1번째 답변에서 "사과" 기준만 채움(안내·대안은 비움) → **재입력이 아니라 손님이 진짜 새 대사("몇 분 정도 더 걸릴까요?")를 함** — 버그 수정 전엔 한 번도 일어나지 않던 일. 진행률·체크리스트·AI 트레이너 힌트도 정확히 갱신됨.
- 2번째 답변에서 "안내" 기준까지 채움(필수 2개 모두 충족, "대안"은 선택이라 안 건드림) → `allCriteriaMet`이 필수 기준만 보고 정확히 true가 되어 완료 화면으로 전환됨.
- 콘솔 에러 없음. 사용한 테스트 계정·매장은 검증 직후 스크립트로 정리.

이 작업 전엔 어떤 시나리오로 테스트해도 항상 "오프닝 한 줄 + 알바가 재입력을 반복한 답변들"로만 끝났던 것과 대조적으로, 이제 실제로 여러 턴에 걸친 대화가 진행된다.

## 추가 결정 (2026-07-28) — `MAX_TURNS` 완전히 제거

데모용 매장을 만들면서 AI가 **필수 기준 4개짜리** 루브릭을 생성한 시나리오가 나왔는데, 알바가 실수 하나 없이 매 턴 새로 진전해도 `MAX_TURNS`(3)에 걸려 필수 기준을 다 못 채운 채로 세션이 강제 종료되는 걸 발견했다. 처음엔 `MAX_TURNS`를 5로 올리려 했으나, 더 근본적인 질문을 받았다: "하트가 이미 그 역할을 하는 거 아니야?"

다시 따져보니 맞는 지적이었다:

| 논점 | 결정 | 이유 |
|---|---|---|
| `MAX_TURNS` 자체 | **완전히 제거** — `decideTurnOutcome()`에서 `turnNumber`/`maxTurns` 파라미터를 삭제하고, `completed`는 `allCriteriaMet`(하트 소진이 아닌 한)만으로 결정한다 | 하트(`countOffTopicAttempts`)는 "진전 없는 나쁜 시도" 횟수를, `allCriteriaMet`은 "필수 기준을 다 채웠는지"를 이미 각자 책임진다. 알바가 계속 진전만 하면(하트를 안 깎으면) 세션이 끝날 이유가 없다 — 필수 기준이 몇 개든 자연스럽게 그만큼 진행되다 다 채우면 끝난다. 세션 길이는 사실 "criteria 개수"로 이미 상한이 걸려 있다(진전 하나마다 최소 기준 하나씩 새로 채워야 하므로, 최악의 경우에도 `criteria.length` 턴 안에 전부 소진되거나 끝난다) |
| 기존 데모 데이터(필수 4개 시나리오 2개) | 필수 개수를 억지로 줄이는 대신 원래 AI가 만든 그대로(필수 4개) 유지 | `MAX_TURNS`라는 인위적 제약에 맞추려고 실제 채점 기준(내용)을 낮추는 건 원인과 결과가 뒤바뀐 접근이었다. 코드 쪽 제약을 없애는 게 맞는 방향 |
| 프론트 축하 문구 | `TrainingSession.jsx`의 `allCriteriaMet` state·"훈련이 끝났어요!" 분기 삭제 | `MAX_TURNS`가 없어지면서 `completed && !heartsExhausted`는 항상 `allCriteriaMet === true`를 의미하게 되어, "기준을 다 못 채웠는데 끝난" 경우를 위한 문구·state가 전부 죽은 코드가 됐다 |

### 구현
- `sessionTurns.js`의 `decideTurnOutcome()` 시그니처에서 `turnNumber`/`maxTurns` 제거, `completed: allCriteriaMet`으로 단순화.
- `sessions.js`에서 `MAX_TURNS` 상수·`decideTurnOutcome` 호출의 관련 인자 제거.
- `TrainingSession.jsx` — 이제 도달 불가능해진 "훈련이 끝났어요!"(기준 미충족 완료) 분기와 그 판단에만 쓰이던 `allCriteriaMet` state 삭제.
- `sessionTurns.test.js` — "턴 한도 도달 시 강제 완료" 케이스 삭제(더 이상 존재하지 않는 동작), 나머지 케이스는 `turnNumber`/`maxTurns` 인자만 제거하고 유지. 서버 테스트 114개(1개 감소) + 루트 lint 재확인 통과.

### 검증
필수 기준 4개짜리 데모 시나리오("재료 품절로 인한 대체 옵션 제안")를 브라우저로 실제 플레이 — 4턴에 걸쳐 필수 기준을 하나씩 채워도 중간에 끊기지 않고 4번째 진전에서 정확히 "모든 기준을 완료했어요!"로 끝나는 것 확인.

## 추가 결정 (2026-07-28) — AI 피드백 문장이 이전 턴을 "기억 못 하던" 문제

턴 진행(누가 넘어가는지)은 고쳤지만, `evaluateTurn()`이 매번 **이번 턴의 손님 발화 + 알바 답변 한 쌍만** 프롬프트에 넣고 있었다. 그래서 세션 3턴째에 알바가 이전 두 턴에서 이미 시럽 500원·우유 700원 추가비용을 각각 안내했는데도, 3턴째 피드백이 "추가 비용 안내가 전혀 이루어지지 않았습니다"라고 써버리는 걸 발견했다 — 화면 체크리스트(3/3)는 정확했지만(프론트가 턴마다 상태를 그대로 누적하므로), Gemini가 쓰는 자연어 feedback 문장은 이번 턴만 보고 판단해서 실제 대화 기록과 모순되는 말을 했다.

| 논점 | 결정 | 이유 |
|---|---|---|
| `previouslyMetItems`로 넘기는 범위 | "같은 turnNumber의 재입력"만이 아니라 **세션 전체에서 이미 확정된 기준**(`pickFinalAttempts` 기준)으로 확장 | 재입력 시도의 `evaluation`도 항상 그 시점까지의 누적 결과를 담고 있어서(아래 참고), 이 한 번의 계산이 재입력·이전 턴 두 경우를 다 커버한다 — 예전처럼 따로 계산할 필요가 없다 |
| `evaluator.js` 프롬프트 문구 | "같은 손님 질문에 대한 이전 시도"라는 재입력 전용 표현을 "이 대화의 앞선 턴"으로 일반화하고, **"이 항목들을 누락됐다고 쓰지 마라"는 지시를 feedback 작성 규칙에 명시적으로 추가** | met_items는 코드로 강제 보정되지만 feedback 텍스트는 Gemini가 자유롭게 쓰는 문장이라, met 여부만 알려주고 "언급하지 말라"고 안 하면 여전히 "누락"이라고 쓸 수 있다 |
| 테스트 | 추가 안 함 | `evaluator.js`는 실제 Gemini 호출이 핵심이라 이 프로젝트에 기존 단위테스트가 없다(프롬프트 문구 교정이라 스냅샷 테스트도 의미가 적음). 브라우저로 3턴 실제 재현해 피드백 문장을 직접 확인 |

### 구현
- `sessions.js` — `priorMetItems`(세션 전체 누적) 계산을 `evaluateTurn` 호출 **이전**으로 옮기고, 그 결과를 `previouslyMetItems`로 그대로 전달. 기존에 따로 있던 "재입력 전용" 계산 블록은 삭제(중복 제거).
- `evaluator.js` — `previouslyMetText` 문구를 턴 범위에 안 갇히게 일반화 + "feedback에 누락됐다고 쓰지 마라" 지시 추가.

### 검증
같은 "커스텀 추가 비용 안내 및 주문 확인"(시럽 500원 → 우유 700원 → 복창만) 시나리오를 다시 재현 — 3턴째 피드백이 "고객의 요청에 따라 추가된 두 가지 커스텀 내용을 누락 없이 복창하며... 다만 총 결제 금액도 안내하면 더 완성도 높은 응대가 됩니다"로, 실제 대화 맥락과 모순 없이 정확하게 나오는 것 확인.
