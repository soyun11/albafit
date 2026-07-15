# guest-try-feature.md — 비회원 체험(매장 연결 없이 롤플레잉 맛보기)

> `docs/auth-improvement-plan.md`, `docs/store-creation-improvements.md`와 같은 방식으로 기록한다.

## 왜 만들었나

지금까지는 "사장님이 먼저 회원가입 → 매장 생성 → 규칙 입력 → 루브릭 승인"까지 끝나야 누구든 실제 훈련(손님과의 대화)을 경험할 수 있었다. 서비스를 계속 키우려면 사장님이 움직이기 전에도 일반인(특히 알바)이 매장 연결 없이 먼저 맛보고, 마음에 들면 사장님한테 소개하는 역방향 확산 경로가 필요하다고 판단했다. Duolingo·Canva 같은 PLG(제품 주도 성장) 서비스들이 쓰는 "일단 무료로 체험 → 진짜 필요하면 가입" 패턴.

## 왜 기술적으로 쉬웠나

손님 에이전트(`getCustomerReply`)·평가 에이전트(`evaluateTurn`)·루브릭 생성(`generateRubric`)이 전부 DB에 직접 의존하지 않는 순수 함수였다 — DB 저장은 각 라우트(`sessions.js`, `stores.js`)가 별도로 하는 부분이라, 저장 없이 그 함수들만 그대로 재사용하는 "체험판 전용 라우트"를 새로 만들면 됐다.

## 구현

### 백엔드 — `server/src/routes/guest.js` (완전 비인증, DB 저장 없음)
- `server/src/lib/industryScenarios.js` 신규 — `stores.js`에 있던 업종별 시나리오 목록(`INDUSTRY_SCENARIOS`)을 여기로 옮겨서 `stores.js`·`guest.js` 둘 다 재사용(중복 방지).
- `GET /api/guest/opening?scenarioType=xxx` — 손님 오프닝 대사(LLM 호출 없음, 즉시 응답).
- `POST /api/guest/rubric` — `{ scenarioType, rawRulesText }` → 실제 Gemini로 채점 기준 생성, DB에 안 남김.
- `POST /api/guest/turn` — `{ scenarioType, criteria, messages, staffAnswer }`(`messages`는 클라이언트가 들고 있는 지금까지의 대화) → 실제 Gemini 채점 + 실제 OpenAI 손님 다음 대사. 3턴 채우면 `completed: true`.

### 프론트 — `src/components/GuestTry.jsx` + `.css` 신규
업종 선택 → 시나리오 선택 → 규칙 텍스트 입력 → (실제 AI가 만든) 채점 기준 카드 확인 → 대화 체험(3턴) → "무료로 시작하기" 회원가입 유도까지 4단계, 전부 이 컴포넌트의 로컬 state로만 굴러간다. 업종·시나리오 목록은 `IndustrySelect.jsx`/`ScenarioSelect.jsx`와 공유하기 위해 `src/lib/industries.js`로 분리했다(컴포넌트 파일에서 직접 export하면 Fast Refresh가 깨진다는 oxlint 경고도 이 참에 같이 해결).

### 랜딩페이지 — `src/components/LandingPage.jsx`
- 상단바 "기능"/"도입사례"를 클릭 안 되는 장식용 텍스트에서 실제 앵커 스크롤 링크로 변경.
- 히어로 CTA에 "매장 없이 체험하기"(보조 버튼)를 "시작하기"(사장님 전용, 주 버튼) 옆에 추가.

## 알려진 리스크 (아직 안 고침)
**인증 없이 유료 LLM(OpenAI+Gemini)을 직접 호출하는 공개 엔드포인트라서, 어뷰징 시 비용이 새어나갈 수 있다.** 지금은 4주 챌린지 데모 범위라 그대로 두지만, 실제로 서비스를 공개 배포하기 전에는 최소한 IP당 요청 횟수 제한 정도는 반드시 추가해야 한다.

## 검증
- curl: `/api/guest/opening`, `/api/guest/rubric`, `/api/guest/turn` 3턴 체이닝 — 전부 인증 없이 동작, 실제 AI 응답 확인.
- 브라우저: 로그아웃 상태로 랜딩 → 상단바 "기능" 클릭 시 스크롤 이동 확인 → "매장 없이 체험하기" → 음식점 업종 → "맛·이물질 컴플레인" 시나리오 → 임의 규칙 텍스트 입력 → 실제 Gemini가 만든 채점 기준 3개 확인 → 대화 체험(애매한 답변 → 손님이 되묻는 것, 채점 결과 0/3인 것까지) 확인.
- `npm run lint` 통과(공유 상수 분리로 Fast Refresh 경고도 해결).
