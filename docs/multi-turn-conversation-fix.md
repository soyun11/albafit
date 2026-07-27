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
