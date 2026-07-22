# evaluation-calibration.md — 평가 에이전트 캘리브레이션

> `docs/rubric-reuse.md`, `docs/evaluation-cross-check.md`와 같은 방식으로 기록한다. 관련 이슈: `soyun11/hub#6`. 근거: `docs/checklist.md` 3주차 7/22 섹션.

## 왜 만들었나

평가 에이전트(Gemini, `server/src/lib/evaluator.js`)는 이 서비스에서 할루시네이션 리스크가 가장 큰 지점이다. 오늘 만든 교차검증(`docs/evaluation-cross-check.md`)은 "다른 모델과 비교해서 의심스러운 항목을 자동으로 찾아내는" 기능이었다면, 이번 캘리브레이션은 **사람(사장님)이 실제 훈련 기록을 직접 보고 채점이 맞았는지 확인·수정하는 human-in-the-loop 기능**이다 — 사람이 확인하는 게 신뢰성 확보의 마지막 방어선이다.

지금은 사장님이 알바의 채점 결과를 볼 방법이 리포트 화면의 집계(`ok`/`wait` 라벨)뿐이고, 그 판정이 맞았는지 확인하거나 고칠 방법이 전혀 없다. AI가 실수로 "사과 안 함"이라고 잘못 채점해도 알바는 그 잘못된 피드백을 그대로 받는다.

완료 기준(이슈 그대로): **사장님이 실제 훈련 기록을 보고 채점이 맞았는지 검토·수정할 수 있다.**

구현 전 `task-planner` 에이전트로 작업을 쪼개 검토했고, 나온 결정 중 핵심(검토 단위, 저장 위치, 화면 분리)을 사용자가 확정했다 — 아래 "결정" 표에 반영.

## 결정

| 논점 | 결정 | 이유 |
|---|---|---|
| 검토 단위 | **세션의 개별 턴** (손님 발화·알바 답변·Gemini 판정 하나하나) | 집계된 라벨만으로는 "왜 이렇게 채점됐는지"가 안 보여 교정이 불가능하다. `GET /api/sessions/:id`(`server/src/routes/sessions.js`)가 이미 세션의 원본 턴 데이터(`customerMessage`/`staffAnswer`/`evaluation` 전체)를 소유권 확인(`session.storeId === req.user.storeId`)까지 포함해 내려주고 있어 그대로 재사용한다 — 새 조회 API를 안 만들어도 된다. |
| 교정 결과물 | **항목별 met/unmet 토글 + 자유 텍스트 코멘트**. `improvedAnswer`(AI가 제시한 개선 문장) 재작성은 스코프 밖 | 완료 기준은 "채점이 맞았는지 검토·수정"이지 AI가 쓴 문장을 사장님이 다시 쓰는 게 아니다. |
| 저장 위치 | `SessionTurn.evaluation`(JSONB)을 덮어쓰지 않고, `evaluation.ownerCorrection = { correctedItems: [{item, met}], comment, correctedAt }`으로 원본 Gemini 판정 옆에 분리 저장 | 원본 AI 판정을 잃어버리면 나중에 "AI가 어떤 유형을 자주 틀리는지" 비교할 근거가 사라진다. Prisma 스키마 변경(마이그레이션) 없이 JSONB 안에서 확장 — `docs/db-schema.md`의 `evaluation` 컬럼 주석만 갱신한다. |
| "오답 케이스 모아 루브릭·프롬프트 다듬기" 자동화 | **이번 이슈에서 자동화하지 않는다** — 정정이 DB에 쌓이는 것 자체가 원재료 축적(교차검증 로그와 같은 관계). 루브릭/프롬프트를 자동으로 고치는 기능은 과설계 | 4주 챌린지 규모에서 "사람이 보고 고칠 수 있다"까지가 이슈의 실제 완료 기준이다. |
| 엣지 케이스 테스트(빈 답변/무관한 답변/규칙에 없는 얘기) | **새 프로덕션 코드가 아니라 검증 활동** — 실제 `evaluateTurn`에 애매한 입력을 넣어보고 결과를 이 문서에 기록. 별도 eval 셋 파일은 신설하지 않는다 | `docs/backlog.md`가 "eval 셋을 시나리오 제안·평가에도 확장"을 이미 7/23 별도 "여유" 과제로 분리해둬서 겹치면 중복 작업이 된다. "완전히 빈 답변"은 `POST /:id/turns`가 이미 400으로 막고 있어 그 동작만 재확인한다. |
| FE 화면 | 알바용 `FeedbackReport.jsx`를 확장하지 않고 **사장님 전용 새 화면**(`TurnCalibrationReview.jsx`) 신설 | 턴별 원본 대화+교정 UI는 사장님만 봐야 하는 기능이라, 기존에 API 레벨에서 지켜온 역할 분리 원칙을 화면에도 그대로 적용한다. |

## 다음 단계 (TDD로 순서대로 진행)

1. ~~설계 결정 문서화 (이 문서)~~ — 완료
2. `GET /api/stores/me/staff/:staffId/latest-report` 응답에 `sessionId` 추가 (FE가 턴 상세로 넘어가는 연결고리)
3. 순수 함수 `buildTurnCalibrationView(sessionTurns)` (`server/src/lib/evaluationCalibration.js`, 가칭) — 테스트 먼저
4. 순수 함수 `applyOwnerCorrection(evaluation, correction)` — 원본 metItems 보존, `ownerCorrection`만 병합 — 테스트 먼저
5. `findOwnedTurn(turnId, storeId)` — `rubrics.js`의 `findOwnedRubric` 패턴, `vi.mock('../lib/prisma.js')`로 테스트
6. API `PATCH /api/sessions/turns/:turnId/calibration` (`requireAuth` + `requireRole('owner')`) — 3~5를 엮는 라우트
7. BE 통합 수동 확인 (DB에서 원본 metItems 안 건드려졌는지, `ownerCorrection`만 새로 생겼는지)
8. FE `TurnCalibrationReview.jsx` — 턴별 카드(손님 발화/알바 답변/Gemini 판정+피드백+개선문장), 항목별 met 토글 + 코멘트 + 저장. `ReportList`→`FeedbackReport`(사장님이 보는 경우에만) 진입 버튼 추가
9. FE↔API 연동 확인 (met 뒤집기 → 새로고침해도 유지되는지)
10. 엣지 케이스 검증(성의없는 답변/무관한 답변/규칙에 없는 얘기) — 결과를 이 문서에 기록
11. `feature-verifier`로 최종 검증

## 구현·검증

### 백엔드 (`server/src/lib/evaluationCalibration.js`, `server/src/routes/sessions.js`, `server/src/routes/stores.js`)
- `buildTurnCalibrationView`/`applyOwnerCorrection`/`findOwnedTurn` 순수 함수·DB 헬퍼 — 테스트 11개(`evaluationCalibration.test.js`), mock 없이(순수 함수)·`vi.mock('./prisma.js')`로(DB 헬퍼) 작성.
- `GET /api/sessions/:id` 응답에 `turns: buildTurnCalibrationView(...)` 추가(additive, 기존 `sessionTurns` 필드는 유지), `PATCH /api/sessions/turns/:turnId/calibration`(`requireAuth`+`requireRole('owner')`) 신규, `GET /me/staff/:staffId/latest-report`에 `sessionId` 추가.
- 전체 서버 테스트 57개 + 루트 lint 통과.

### 프론트엔드 (`src/components/TurnCalibrationReview.jsx`, `src/lib/screenAccess.js`)
- 사장님 전용 신규 화면. `screenAccess.js`의 `OWNER_SCREENS`에 `calibration` 추가(테스트로 고정) — 알바 계정은 절대 접근 못 하게.
- `FeedbackReport.jsx`에 `onCalibrate` prop 추가 — 사장님이 남의 리포트를 볼 때만(`reportStaffName`이 있을 때만) "AI 채점 검토하기" 버튼이 뜨고, 알바 본인이 자기 결과를 볼 때는 기존 "리포트 공유" 버튼이 그대로 뜬다.
- 루트 테스트(9개) + lint + `vite build` 통과.

### 통합 검증 (`feature-verifier` 에이전트, BE curl 검증 + 직접 브라우저 조작)
**BE (`feature-verifier`, 실제 서버·DB, 새 테스트 매장으로 진행 후 정리)**
- `latest-report`의 `sessionId`가 실제 세션 id와 일치, 그 값으로 `GET /:id` 호출 시 `turns[]`가 기대한 필드(`turnId/turnNumber/retryCount/customerMessage/staffAnswer/passed/metItems/feedback/improvedAnswer/ownerCorrection`)를 정확히 반환.
- `PATCH .../calibration` 저장 후 원본 `metItems`/`feedback`/`improvedAnswer`는 diff상 완전히 무변형, `ownerCorrection`만 추가됨.
- 존재하지 않는 item 이름 + `met`이 boolean이 아닌 값은 조용히 필터링되어 저장 안 됨(에러도 안 남).
- 다른 매장 turnId → 403, `role: staff` 토큰 → 403(`requireRole`이 라우트 진입 전에 차단).
- (관찰) 성의없는 답변·완전 무관한 답변 둘 다 Gemini가 `met:false`로 정직하게 판정, feedback도 구체적 — 할루시네이션 없이 미충족 처리됨. 다만 required 1개짜리 단순 시나리오라 "절반만 충족" 같은 경계선 케이스까지는 관찰 못 함.

**FE (직접 브라우저로 클릭 확인, `claude-in-chrome`)**
- 테스트 계정으로 매장 생성 → 규칙 제출 → 루브릭 승인 → 알바 훈련(재입력 1회 포함, 필수 3항목 중 1개 미충족→재입력→충족) → 사장님으로 리포트 진입 → "AI 채점 검토하기" 클릭 → 턴별 카드(손님 발화/알바 답변/Gemini 판정 3개 칩/AI 피드백)가 정확히 표시됨을 확인.
- 미충족 칩을 클릭해 충족으로 토글 → 코멘트 입력 → "교정 저장" → "저장됐어요" 표시 및 "사장님 교정 있음" 배지 확인.
- 전체 페이지 새로고침 + 리포트 목록부터 다시 진입해도 토글 상태·코멘트·배지가 그대로 유지됨을 확인(DB 영속성).
- 발견한 사소한 문제: 같은 턴(turnNumber)의 재입력 시도가 별도 카드로 나뉘어 보이는데 둘 다 "TURN 1"로만 표시돼 구분이 안 됨 → `retryCount > 0`일 때 "· 재시도 N"을 라벨에 추가해 즉시 수정, 브라우저로 재확인 완료.
- 콘솔 에러 없음.
- **정리 못 한 것**: 브라우저 검증에 쓴 테스트 매장/계정(`browsercheck-owner-*@test.local` 등)은 삭제를 시도했으나, 이 환경의 샌드박스에서 독립 실행한 Prisma 스크립트가 Supabase 커넥션을 못 맺어(ECONNREFUSED, 실행 중인 서버 프로세스를 통한 API 호출은 정상 동작함) DB에서 직접 지우지 못했다. 데모 프로덕션 계정(`demo.owner@albafit.kr`)과는 무관한 격리된 테스트 데이터이며, 다음에 Supabase 콘솔이나 서버 경유로 수동 정리가 필요하다.

이슈(`soyun11/hub#6`)의 완료 기준 — "사장님이 실제 훈련 기록을 보고 채점이 맞았는지 검토·수정할 수 있다" — BE API와 실제 화면 클릭 흐름 둘 다로 확인 완료.

## 추가: 정정 이력 모아보기 (사용자 직접 수동 테스트 중 발견)

캘리브레이션 화면을 사용자가 직접 브라우저로 눌러보다가 "코멘트를 남겨도 그걸 한눈에 모아보는 곳이 없으면, 아무도 안 읽는 데이터 창고가 될 것 같다"는 지적이 나왔다. 원래 백로그 11번("정정 이력 모아보기")에 "여유" 등급으로만 남겨뒀던 항목인데, 이 지적을 듣고 나니 이슈 완료 기준을 문자 그대로는 충족해도 기능이 실제로 쓸모 있으려면 사실상 필수에 가깝다고 판단해 오늘 스코프에 편입했다.

- **결정**: 별도 큰 대시보드 대신, 매장 전체에서 `ownerCorrection`이 있는 턴만 모아 최근순으로 보여주는 간단한 표 하나(`CorrectionHistory.jsx`, `GET /api/stores/me/corrections`)만 추가. 항목 값을 실제로 안 바꾸고 코멘트만 남긴 경우("AI 판정이 맞다고 확인만 한 것")도 구분해서 보여준다 — 캘리브레이션이 "틀린 것만 고치는 기능"이 아니라 "맞는지 확인하는 기능"이기도 하다는 걸 반영.
- **구현**: 순수 함수 `buildCorrectionHistory(sessionTurns)` (`server/src/lib/evaluationCalibration.js`) — 원본 met 값과 실제로 다른 항목만 `changedItems`에 담고, 나머지는 빈 배열로 둬서 화면에서 "확인만 함" 배지로 구분. 테스트 6개 추가(전체 17개). 라우트는 매장의 모든 `SessionTurn`을 조회해 이 함수로 거르는 얇은 껍데기.
- **검증**: 사용자가 직접 남긴 교정(품절 시나리오, 항목 변경 없이 코멘트만) + 앞서 남겨둔 교정(대기시간 항목 미충족→충족) 둘 다 "리포트 → 정정 이력 모아보기"에서 날짜순으로, 전자는 "확인만 함" 배지로 후자는 "미충족 → 충족" 화살표로 구분되어 뜨는 것을 브라우저로 직접 확인.
