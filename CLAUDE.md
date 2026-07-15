# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

매장 맞춤 알바 훈련 서비스 — 사장님이 매장 응대 기준을 한 번 입력해두면, 새 알바가 올 때마다 AI 손님과 실전 대화 연습을 하고 그 기준에 맞춰 교정 피드백을 받는 웹 서비스. 4주 챌린지 프로젝트로, 현재 저장소는 **프론트엔드 뼈대 + 백엔드 개발 환경 스캐폴드까지만 있는 초기 단계**다 (백엔드 API·DB 연결·AI 로직 자체는 아직 구현 전 — `server/`에 빈 껍데기 Express 서버와 Prisma 스키마만 있다).

전체 기획·아키텍처·근거는 `docs/plan.md`에 있다 — 이 리포지토리에서 작업할 때 반드시 먼저 읽을 것. DB 스키마는 `docs/db-schema.md`, 4주 작업 순서는 `docs/checklist.md`에 있다.

## Commands

프론트 (루트):
- `npm run dev` — Vite 개발 서버 실행
- `npm run build` — 프로덕션 빌드
- `npm run preview` — 빌드 결과 로컬 미리보기
- `npm run lint` — oxlint 실행, `server/`까지 포함한 리포 전체 대상 (설정: `.oxlintrc.json`, `react`/`oxc` 플러그인 + `server/**/*.js` node env override)

백엔드 (`server/`, 독립 `package.json`):
- `npm run server:install` — 루트에서 `server/` 의존성 설치 (최초 1회, `npm install --prefix server`)
- `npm run server:dev` — 루트에서 백엔드 dev 서버 실행 (`--prefix server`로 위임, 내부적으로 `node --watch src/index.js`)
- 현재는 `/api/health` 헬스체크 하나만 있는 빈 껍데기다. DB 연결·API 라우트·에이전트 호출은 `docs/checklist.md` 1~2주차에 채운다. 자세한 구조·라이브러리 선택 이유는 아래 "개발 환경" 절 참고.

테스트 러너는 아직 없다 (코드도 없음). 2주차 이후 코어 로직이 생기면 **Vitest**로 붙이기로 정했다 — 그 전엔 추가하지 않는다.

## Architecture

### 현재 상태
`src/App.jsx`가 `src/components/ProjectIntro.jsx` 하나만 렌더링하는 정적 소개 페이지 수준. 실제 서비스 화면 8개(`ui/1_업종선택.png` ~ `ui/8_사장님리포트.png`, HTML 목업은 `ui/prototype/`)는 아직 컴포넌트로 구현되지 않았다. 파일 확장자는 `.jsx`이며 TypeScript는 쓰지 않는다.

### 앞으로 만들 핵심 구조 (docs/plan.md 5절 기준)

서비스의 코어는 **목적이 다른 두 개의 LLM 에이전트가 상태를 주고받으며 도는 턴제 루프**다. 이 구조를 유지하는 것이 제품 품질의 전부이므로, 관련 코드를 건드릴 땐 아래 원칙을 지킨다.

- **손님 에이전트** (OpenAI `gpt-4o-mini`) — 페르소나·시나리오 상태(주문 상태·손님 기분·경과 턴)를 유지하며 애드리브. 할루시네이션 위험 낮음(애드리브가 자산). 호출이 잦아 저비용 모델을 쓴다.
- **평가 에이전트** (Google `gemini-3.5-flash`) — 루브릭 항목별로 답변을 채점. 할루시네이션 위험이 여기 몰려 있어 방어가 필수 — 출력은 반드시 JSON(`{충족여부, 빠진기준[], 피드백, 개선문장}`)으로 강제하고(Gemini `responseSchema`/`responseMimeType: "application/json"` 사용), 판단 근거를 규칙 인용으로 대게 한다.
- 2026-07-14, 비용 비교 끝에 Claude(Haiku/Sonnet)에서 OpenAI+Gemini 조합으로 전환 — `server/src/lib/openai.js`, `server/src/lib/gemini.js` 참고. `docs/plan.md` 5-3에 있던 Claude 기준 서술은 이 절이 최신이다.
- **두 에이전트는 절대 한 호출로 합치지 않는다** — 시스템 프롬프트·요구 품질·모델이 다르기 때문.
- **루브릭 = 할루시네이션 방어막**: 사장님이 입력한 자연어 규칙을 AI가 그대로 판단하게 하면 안 되고, 반드시 "①②③ 있는지 체크"처럼 닫힌 채점표(루브릭)로 먼저 변환한 뒤 그 루브릭 기준으로만 채점하게 한다.
- **AI는 생성, 사장님은 승인** — 규칙→루브릭 변환, 시나리오 초안 생성은 AI가 하되 사장님 승인 없이 확정하지 않는다. AI는 업종 일반 상식까지만 알아야 하고 브랜드별 정책(예: 특정 프랜차이즈 환불 규정)은 지어내면 안 된다.
- 데이터 접근은 처음엔 순수 API 호출로 구현하고, 이후 MCP 서버(tool: `get_store_rules`, `get_rubric`, `save_session_turn`, `get_session_report`)로 전환한다. 코어(대화+평가)와 배포가 끝나기 전엔 MCP 전환에 손대지 않는다.

### 데이터 모델 (docs/db-schema.md)

- 2026-07-15부터 사장님·알바 둘 다 이메일+비밀번호 계정(`users`, bcrypt+JWT)으로 로그인한다. 매장 링크(`stores.link_key`)는 폐기하지 않고 **알바 초대용**으로 남아있지만, 알바 계정은 셀프 가입이 아니라 로그인한 사장님이 대시보드에서 이메일+초기 비밀번호를 정해 만들어준다(`POST /api/stores/me/staff`). 알바는 로그인 후 `PATCH /api/auth/password`로 자기 비밀번호를 바꿀 수 있다.
- `POST /api/stores`(매장 생성)는 로그인한 사장님(`role: owner`)만 호출 가능하고, 성공하면 그 계정의 `users.store_id`를 채운 뒤 갱신된 `storeId`를 담은 새 JWT를 응답에 같이 내려준다 — 클라이언트는 이 토큰으로 갈아끼워야 그다음 요청부터 자기 매장 소속으로 인증된다(기존 토큰은 storeId가 비어있는 옛 값이라 새로 발급 없이는 못 씀).
- 알바는 여전히 훈련 세션에 자유 텍스트 라벨(`staff_label`)을 남길 수 있다 — 이건 계정 인증과 별개로 리포트에서 구분용 별칭을 쓰기 위한 것이다.
- 테이블: `stores` → `store_rules`, `scenarios` → `rubrics`, `training_sessions` → `session_turns`. `users`는 `store_id`로 `stores`를 참조(nullable — 사장님은 매장 만들기 전엔 비어있음).
- 구조가 시나리오마다 다르고 통으로 읽고 쓰는 값(루브릭 `criteria`, 페르소나, 평가 결과 등)은 JSONB 컬럼에 담는다.
- `store_rules.raw_text`는 사장님이 입력한 원문을 그대로 보존한다 — 루브릭 재생성 시 원문이 필요하기 때문에 변환 후에도 지우지 않는다.
- `rubrics.approved_at`이 null이면 AI가 만든 승인 전 초안 상태다.

### 배포 대상

백엔드는 Railway, DB는 Supabase(Postgres), 프론트는 Vercel (아직 이 저장소에서 설정 전). DB는 원래 Railway Postgres였으나 2026-07-13 과제 요구사항에 맞춰 Supabase로 전환 — 자세한 경위는 `docs/db-migration-plan.md` 참고.

## 개발 환경 (2026-07-10 결정)

React/Express가 기본 스택이라는 건 plan.md에 이미 정해져 있었고, 여기서는 **그 위에서 구체적으로 어떻게 나눌지**를 정한 결정 기록이다.

### 디렉토리 구조

```
hub/
├─ src/                      # 프론트 (Vite + React) — 기존 그대로, 옮기지 않음
├─ server/                   # 백엔드 (Express) — 독립 package.json
│  ├─ src/
│  │  ├─ index.js            # 앱 엔트리 + /api/health 헬스체크만 있는 상태
│  │  ├─ routes/             # API 라우트 추가 위치 (아직 비어있음)
│  │  └─ lib/                # openai.js, gemini.js 클라이언트, rubric.js 변환 함수
│  ├─ prisma/schema.prisma   # docs/db-schema.md 6개 테이블을 그대로 옮긴 모델
│  └─ .env.example
└─ docs/
```

- **프론트는 루트에 그대로 두고 `server/`만 새로 추가**한다 — npm workspaces로 재구성(`client/`+`server/`)하지 않는다. 이 리포는 여러 수강생이 각자 브랜치로 작업 중이라, 기존 프론트 파일 경로(`src/`, `vite.config.js`, `index.html`)를 옮기면 다른 브랜치·PR과 충돌 범위가 커진다.
- `server/`는 루트와 독립된 `package.json`·`node_modules`를 가진다 (workspaces 아님, 그냥 형제 디렉토리).

### 라이브러리 선택

- **express** — plan.md 지정 스택
- **@prisma/client** + **prisma** — checklist.md 권장 ORM. `server/prisma/schema.prisma`는 `docs/db-schema.md`를 그대로 옮긴 것이므로, **스키마를 바꿀 땐 두 파일을 같이 수정**한다.
- **openai** — 손님 에이전트(`gpt-4o-mini`) 호출용
- **@google/genai** — 평가·루브릭 변환 에이전트(`gemini-3.5-flash`) 호출용, JSON 스키마 강제(`responseSchema`)에 사용
- **cors**, **dotenv** — 로컬에서 프론트(Vite, 기본 5173 포트) 요청 허용 + `.env` 로드
- 파일 변경 감지 재시작은 별도 `nodemon` 없이 **Node 내장 `--watch`** 사용 (Node 20+ 전제) — 의존성 하나를 줄이는 선택

### 환경 변수

- `server/.env.example`에 `DATABASE_URL`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `PORT`, `CORS_ORIGIN`을 정의해 커밋한다. 실제 값은 `server/.env`에 로컬로만 채운다.
- 루트 `.gitignore`에 `.env`/`.env.*`(`.env.example` 제외) 무시 규칙을 추가했다 — **기존에는 이 규칙이 없어서 실수로 커밋될 수 있는 상태였다.**
- Railway 배포 시 같은 키를 Railway 프로젝트 환경변수로 그대로 옮긴다.

### 코드 컨벤션

- 백엔드도 프론트와 동일하게 **JavaScript(ESM, `"type": "module"`)만 쓰고 TypeScript는 쓰지 않는다** — 스택을 하나로 유지해 4주 안에 타입 설정 오버헤드를 늘리지 않으려는 의도적 선택.
- 세미콜론 없음 — 기존 프론트 코드 스타일(`src/App.jsx` 등)을 백엔드에도 그대로 적용.
- lint는 루트 `npm run lint` 하나로 프론트+백엔드 전체를 커버한다. `.oxlintrc.json`에 `server/**/*.js` 전용 override(`env.node: true`)를 추가해 `process`/`console` 같은 Node 전역이 오탐되지 않게 했다 — 새 백엔드 코드가 lint 에러 없이 통과하는지는 항상 루트에서 `npm run lint`로 확인한다.
- 테스트 러너는 **Vitest**로 정했다 (Vite 스택과 궁합이 좋고, 백엔드도 순수 API 호출 로직이라 별도 설정 없이 재사용 가능). 2주차 이후 코어 로직(A/B 에이전트)이 생기기 전까진 추가하지 않는다.
- 커밋 메시지·PR 규칙은 백엔드도 아래 "Repo 운영 방식" 절과 동일하게 따른다.

### 실행 방법

- 프론트: 루트에서 `npm run dev`
- 백엔드: `npm run server:install`(최초 1회) → `npm run server:dev` (또는 `cd server && npm run dev`)

## Repo 운영 방식 (다인원 공유 챌린지 리포)

이 저장소는 여러 수강생이 각자 브랜치(`N082_박소윤` 등)로 작업해 `main`에 PR을 보내는 공유 리포다. PR 작업 시 아래를 지킨다.

- **PR 타이틀**: `[루카스아이디_실명] - 작업 요약` 형식 (예: `[N100_윤솔빈] 주문정보 페이지 개발`).
- **PR 본문**: `.github/pull_request_template.md` 기준 "주요 작업 리스트 / 내가 설명할 수 있는 부분 / 아직 이해 못 한 부분 / 새로 알게 된 것" 섹션을 채운다.
- **커밋 메시지**: conventional commits 스타일(`feat:`, `fix:`, `docs:`, `refactor:` 등)을 그대로 따른다.
- **자동 머지 주의**: `.github/workflows/auto-merge.yml`이 매일 정오(UTC 13:00) `main` 타겟 오픈 PR을 스캔해 `review` 라벨이 없고 변경요청 상태가 아니며 충돌이 없으면 **자동으로 머지**한다. 충돌 PR은 자동으로 닫히고 코멘트가 남는다. 병합 전 리뷰가 필요하면 `review` 라벨을 붙여야 한다.
