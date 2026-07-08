# db-schema.md — DB 스키마 (PostgreSQL)

> [plan.md](./plan.md) 5-5의 상세 스키마. 매장 맞춤 알바 훈련 서비스 MVP 기준.

## 설계 원칙

- 로그인이 없으므로 모든 것은 **매장 링크(`stores.link_key`)를 루트로 매달린다.**
- 알바는 계정이 없어 세션에 자유 텍스트 라벨(`staff_label`)만 남긴다 — 신원 관리가 아니라 "리포트에서 구분만 되면 된다"는 요구 수준에 맞춘 의도적 단순화다.
- 루브릭·평가 결과처럼 구조가 시나리오마다 다르고 통으로 읽고 쓰는 값은 **JSONB 컬럼**에 담아 유연성을 확보한다.

## ERD

```mermaid
erDiagram
    STORES ||--o{ STORE_RULES : has
    STORES ||--o{ SCENARIOS : has
    STORES ||--o{ TRAINING_SESSIONS : has
    SCENARIOS ||--o{ RUBRICS : has
    SCENARIOS ||--o{ TRAINING_SESSIONS : used_in
    TRAINING_SESSIONS ||--o{ SESSION_TURNS : has
```

## 테이블 정의

```sql
-- 매장: 로그인 없이 링크(slug)로 식별되는 루트 엔티티
CREATE TABLE stores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_key      VARCHAR(32) UNIQUE NOT NULL,        -- 매장 링크의 슬러그
  industry      VARCHAR(50) NOT NULL DEFAULT 'cafe', -- MVP는 cafe 고정
  name          VARCHAR(100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 사장님이 입력한 원본 규칙 (자연어 그대로 보관 — 루브릭 재생성 시 원문이 필요)
CREATE TABLE store_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category      VARCHAR(50),                  -- 예: 환불, 지연, 금지표현
  raw_text      TEXT NOT NULL,
  source        VARCHAR(20) NOT NULL DEFAULT 'text', -- text | photo(v1.5)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 시나리오: 업종 템플릿 기반, 손님 역할의 페르소나·초기 상태를 담음
CREATE TABLE scenarios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  type          VARCHAR(30) NOT NULL,         -- delay | out_of_stock | rule_violation
  title         VARCHAR(100) NOT NULL,
  persona       JSONB NOT NULL,               -- 손님 역할 성격·말투·초기 감정
  initial_state JSONB NOT NULL DEFAULT '{}',  -- 주문 상태·손님 기분 등 시나리오 초기값
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 루브릭: 규칙 → 채점 가능한 기준으로 변환된 결과. approved_at이 null이면 승인 전 초안
CREATE TABLE rubrics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id   UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  criteria      JSONB NOT NULL,   -- [{item, required: bool, good_example, bad_example}]
  version       INT NOT NULL DEFAULT 1,       -- 사장님이 수정할 때마다 증가
  approved_at   TIMESTAMPTZ,                  -- null = 승인 대기 초안 (plan.md 5-3 승인 루프)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 훈련 세션: 알바 1명이 시나리오 1개에 도전한 단위
CREATE TABLE training_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  scenario_id   UUID NOT NULL REFERENCES scenarios(id),
  staff_label   VARCHAR(50),                  -- 로그인 없음 — 자유 입력 라벨(예: "지우")
  status        VARCHAR(20) NOT NULL DEFAULT 'in_progress', -- in_progress | completed
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

-- 턴 단위 대화·평가 로그: 손님 발화 → 알바 답변 → 평가 판단
CREATE TABLE session_turns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  turn_number       INT NOT NULL,
  customer_message  TEXT NOT NULL,
  staff_answer      TEXT NOT NULL,
  evaluation        JSONB NOT NULL,   -- {충족여부, 빠진기준[], 피드백, 개선문장}
  passed            BOOLEAN NOT NULL,
  retry_count       INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_stores_link_key ON stores(link_key);
CREATE INDEX idx_training_sessions_store_id ON training_sessions(store_id);
CREATE INDEX idx_session_turns_session_id ON session_turns(session_id);
```

## 설계 메모

- **JSONB를 쓰는 이유**: 루브릭 `criteria`와 턴의 `evaluation`은 항목 수·구조가 시나리오마다 다르고, 지금은 전체를 통으로 읽고 쓰는 것이 대부분이라 컬럼으로 쪼갤 이득이 없다. "②번을 가장 많이 틀린 매장 찾기"처럼 JSONB 내부를 조건 검색해야 하는 요구가 생기면 그때 GIN 인덱스를 추가하거나 컬럼으로 승격한다 — v1에서 미리 하지 않는다.
- **`rubrics.approved_at`이 nullable인 것 자체가** plan.md 5-3의 "AI는 생성, 사장님은 승인" 루프를 스키마 레벨에서 표현한다: 승인 전(=`approved_at IS NULL`) 세션 생성을 막는 체크는 애플리케이션 레벨에서 건다.
- **ORM**: Prisma 권장(마이그레이션·타입 안전성을 4주 안에 거의 공짜로 얻음). raw SQL/Knex로 대체해도 스키마 자체는 동일하게 쓸 수 있다.