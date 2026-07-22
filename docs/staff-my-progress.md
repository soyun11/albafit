# staff-my-progress.md — 알바용 "내 훈련 현황" 화면 신설

> `docs/rubric-reuse.md`와 같은 방식으로 기록한다. 근거: 사용자가 알바 nav를 감사하다 발견한 공백, 2026-07-22.

## 왜 만들었나

알바 nav가 "시나리오 선택" 링크 1개뿐이라 허전했던 진짜 이유를 조사해보니, 원래 목업(`ui/prototype/my_progress.html`, "내 훈련 현황")에는 있던 알바 전용 화면이 React로 전혀 포팅되지 않았고, 이걸 볼 수 있는 백엔드 API도 없었다. `docs/plan.md`의 원래 "8개 화면" 리스트에 이 9번째 화면이 나중에 추가됐는데, 이후 "React 컴포넌트화" 트래킹 항목에는 원래 8개만 남아있어 자연스럽게 누락된 것으로 보인다(의도적으로 뺀 기록은 없음). 알바는 지금 로그인해서 어디서도 "내가 지금까지 몇 번, 얼마나 잘했는지"를 확인할 방법이 없었다.

## 결정

| 논점 | 결정 | 이유 |
|---|---|---|
| 스코프 | 목업 그대로가 아니라 **핵심만 가볍게** — 요약 카드, 최근 점수/완료 N/M 통계, 최근 훈련 기록 리스트, "시나리오 선택으로" CTA만. 항목별(기준별) 점수 막대그래프·"지난 훈련 대비 변화"는 뺀다 (사용자 확정) | 항목별 성공률·점수 변화 계산은 데이터 집계가 더 필요해 작업량이 커진다. 핵심 정보(최근 점수·완료 현황·최근 기록)만으로도 "내가 어떻게 하고 있는지" 확인 목적은 충분히 달성된다. |
| 백엔드 재사용 | `server/src/routes/stores.js`의 `GET /me/staff-report`(사장님이 여러 알바를 집계하는 로직)와 같은 계산 방식(`getLatestStoreRuleId`, `computeHearts`, 최신 배치 시나리오 수 기준 완료율)을 알바 본인 1명 기준으로 단순화해서 재사용 | 이미 검증된 계산 로직(최신 배치만 세기, 하트 비율로 점수 매기기)을 그대로 쓰면 사장님이 보는 점수와 알바가 보는 자기 점수가 항상 일치한다. |
| 세션 필터링 | `staffId: req.user.id`로 직접 필터, `belongsToStaff`(레거시 `staffLabel` 폴백)는 안 씀 | 알바 본인의 세션은 항상 로그인 계정으로 만들어져 `staffId`가 채워져 있다 — 여러 알바를 섞어 봐야 하는 사장님 집계와 달리 레거시 폴백이 필요 없다. |

## 다음 단계

1. ~~설계 문서화 (이 문서)~~ — 완료
2. `server/src/lib/myProgress.js` — `buildRecentTrainingHistory(completedSessions, limit)` 순수 함수, 테스트 먼저
3. `server/src/routes/stores.js` — `GET /me/my-progress`(staff 전용) 추가
4. `src/components/MyProgress.jsx` + `MyProgress.css` 신규
5. `src/components/AppNav.jsx`의 `STAFF_LINKS`에 `myProgress` 추가
6. `src/lib/screenAccess.js`/테스트에 `myProgress` 추가
7. `src/App.jsx`에 라우팅 연결
8. `npm test`(서버+루트) + `npm run lint` + `npm run build`
9. 브라우저로 실제 알바 계정 데이터로 확인

## 구현·검증

### 구현
- `server/src/lib/myProgress.js` — `buildRecentTrainingHistory(completedSessions, limit=5)` 순수 함수. 테스트 7개(`myProgress.test.js`) — 정렬, limit, score 계산(하트 비율), 빈 배열, score `null` 케이스까지.
- `server/src/routes/stores.js` — `GET /me/my-progress`(`requireRole('staff')`) 추가. `staffId: req.user.id`로 직접 필터링, `staff-report`와 동일한 최신 배치 기준 완료율 계산.
- `src/components/MyProgress.jsx` + `MyProgress.css` — 요약 카드/통계 2개/최근 기록 리스트/CTA.
- `src/components/AppNav.jsx`의 `STAFF_LINKS`에 `myProgress` 추가, `src/lib/screenAccess.js`/테스트에도 추가.
- `src/App.jsx`에 라우팅 연결.
- 서버 테스트 70개 + 루트 테스트 12개 + lint + build 통과.

### 브라우저 확인 (`claude-in-chrome`, 기존 알바 테스트 계정)
- nav에 "내 현황" 링크가 새로 보임.
- 클릭 시 실제 데이터 정확히 표시됨: "검증알바님, 잘하고 계세요" / "3개 상황 중 2개 완료했어요" / 최근 점수 50점 / 완료 2/3 / 최근 훈련 기록 2건(품절 메뉴 대처 50점, 주문 폭주 대기시간 100점) — 전부 실제 DB 데이터와 일치(사장님 리포트에서 봤던 점수와 동일).
- "시나리오 선택으로" CTA 클릭 → 시나리오 선택 화면으로 정상 이동.
- 콘솔 에러 없음.

이슈 없이 완료. 오늘 처음 발견한 공백(알바가 자기 훈련 이력을 볼 방법이 전혀 없었던 것)을 메웠다.
