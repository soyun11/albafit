# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

매장 맞춤 알바 훈련 서비스 — 사장님이 매장 응대 기준을 한 번 입력해두면, 새 알바가 올 때마다 AI 손님과 실전 대화 연습을 하고 그 기준에 맞춰 교정 피드백을 받는 웹 서비스. 4주 챌린지 프로젝트로, 현재 저장소는 **프론트엔드 뼈대만 있는 초기 단계**다 (백엔드·DB·AI 로직은 아직 구현 전).

전체 기획·아키텍처·근거는 `docs/plan.md`에 있다 — 이 리포지토리에서 작업할 때 반드시 먼저 읽을 것. DB 스키마는 `docs/db-schema.md`, 4주 작업 순서는 `docs/checklist.md`에 있다.

## Commands

- `npm run dev` — Vite 개발 서버 실행
- `npm run build` — 프로덕션 빌드
- `npm run preview` — 빌드 결과 로컬 미리보기
- `npm run lint` — oxlint 실행 (설정: `.oxlintrc.json`, `react`/`oxc` 플러그인)

테스트 러너는 아직 없다. 백엔드(Express)·DB(PostgreSQL)도 아직 이 저장소에 없다 — `docs/checklist.md` 1주차 기준 앞으로 추가될 예정.

## Architecture

### 현재 상태
`src/App.jsx`가 `src/components/ProjectIntro.jsx` 하나만 렌더링하는 정적 소개 페이지 수준. 실제 서비스 화면 8개(`ui/1_업종선택.png` ~ `ui/8_사장님리포트.png`, HTML 목업은 `ui/prototype/`)는 아직 컴포넌트로 구현되지 않았다. 파일 확장자는 `.jsx`이며 TypeScript는 쓰지 않는다.

### 앞으로 만들 핵심 구조 (docs/plan.md 5절 기준)

서비스의 코어는 **목적이 다른 두 개의 LLM 에이전트가 상태를 주고받으며 도는 턴제 루프**다. 이 구조를 유지하는 것이 제품 품질의 전부이므로, 관련 코드를 건드릴 땐 아래 원칙을 지킨다.

- **손님 에이전트** (Claude Haiku 4.5) — 페르소나·시나리오 상태(주문 상태·손님 기분·경과 턴)를 유지하며 애드리브. 할루시네이션 위험 낮음(애드리브가 자산).
- **평가 에이전트** (Claude Sonnet 5) — 루브릭 항목별로 답변을 채점. 할루시네이션 위험이 여기 몰려 있어 방어가 필수 — 출력은 반드시 JSON(`{충족여부, 빠진기준[], 피드백, 개선문장}`)으로 강제하고, 판단 근거를 규칙 인용으로 대게 한다.
- **두 에이전트는 절대 한 호출로 합치지 않는다** — 시스템 프롬프트·요구 품질·모델이 다르기 때문.
- **루브릭 = 할루시네이션 방어막**: 사장님이 입력한 자연어 규칙을 AI가 그대로 판단하게 하면 안 되고, 반드시 "①②③ 있는지 체크"처럼 닫힌 채점표(루브릭)로 먼저 변환한 뒤 그 루브릭 기준으로만 채점하게 한다.
- **AI는 생성, 사장님은 승인** — 규칙→루브릭 변환, 시나리오 초안 생성은 AI가 하되 사장님 승인 없이 확정하지 않는다. AI는 업종 일반 상식까지만 알아야 하고 브랜드별 정책(예: 특정 프랜차이즈 환불 규정)은 지어내면 안 된다.
- 데이터 접근은 처음엔 순수 API 호출로 구현하고, 이후 MCP 서버(tool: `get_store_rules`, `get_rubric`, `save_session_turn`, `get_session_report`)로 전환한다. 코어(대화+평가)와 배포가 끝나기 전엔 MCP 전환에 손대지 않는다.

### 데이터 모델 (docs/db-schema.md)

- 로그인이 없다 — 모든 데이터는 매장 링크(`stores.link_key`)를 루트로 매달린다. 알바는 계정 없이 세션에 자유 텍스트 라벨(`staff_label`)만 남긴다.
- 테이블: `stores` → `store_rules`, `scenarios` → `rubrics`, `training_sessions` → `session_turns`.
- 구조가 시나리오마다 다르고 통으로 읽고 쓰는 값(루브릭 `criteria`, 페르소나, 평가 결과 등)은 JSONB 컬럼에 담는다.
- `store_rules.raw_text`는 사장님이 입력한 원문을 그대로 보존한다 — 루브릭 재생성 시 원문이 필요하기 때문에 변환 후에도 지우지 않는다.
- `rubrics.approved_at`이 null이면 AI가 만든 승인 전 초안 상태다.

### 배포 대상

백엔드·DB는 Railway, 프론트는 Vercel (아직 이 저장소에서 설정 전).

## Repo 운영 방식 (다인원 공유 챌린지 리포)

이 저장소는 여러 수강생이 각자 브랜치(`N082_박소윤` 등)로 작업해 `main`에 PR을 보내는 공유 리포다. PR 작업 시 아래를 지킨다.

- **PR 타이틀**: `[루카스아이디_실명] - 작업 요약` 형식 (예: `[N100_윤솔빈] 주문정보 페이지 개발`).
- **PR 본문**: `.github/pull_request_template.md` 기준 "주요 작업 리스트 / 내가 설명할 수 있는 부분 / 아직 이해 못 한 부분 / 새로 알게 된 것" 섹션을 채운다.
- **커밋 메시지**: conventional commits 스타일(`feat:`, `fix:`, `docs:`, `refactor:` 등)을 그대로 따른다.
- **자동 머지 주의**: `.github/workflows/auto-merge.yml`이 매일 정오(UTC 13:00) `main` 타겟 오픈 PR을 스캔해 `review` 라벨이 없고 변경요청 상태가 아니며 충돌이 없으면 **자동으로 머지**한다. 충돌 PR은 자동으로 닫히고 코멘트가 남는다. 병합 전 리뷰가 필요하면 `review` 라벨을 붙여야 한다.
