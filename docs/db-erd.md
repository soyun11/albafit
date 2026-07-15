# db-erd.md — albafit DB 구조 (필드까지 포함)

> [db-schema.md](./db-schema.md)의 SQL을 그림으로 옮긴 것. `server/prisma/schema.prisma`, Supabase에 적용된 실제 스키마와 동일해야 하며, 스키마가 바뀌면 이 파일도 같이 갱신한다.

## 전체 관계

```mermaid
erDiagram
    STORES ||--o{ USERS : "직원 계정"
    STORES ||--o{ STORE_RULES : "규정 원문"
    STORES ||--o{ SCENARIOS : "시나리오"
    STORES ||--o{ TRAINING_SESSIONS : "훈련 세션"
    SCENARIOS ||--o{ RUBRICS : "루브릭"
    SCENARIOS ||--o{ TRAINING_SESSIONS : "이 시나리오로 진행됨"
    TRAINING_SESSIONS ||--o{ SESSION_TURNS : "턴 기록"
    USERS ||--o{ EMAIL_VERIFICATION_TOKENS : "이메일 인증"
    USERS ||--o{ REFRESH_TOKENS : "로그인 유지"

    STORES {
        uuid id PK
        varchar link_key UK "알바 초대 링크"
        varchar industry "기본값 cafe"
        varchar name
        timestamptz created_at
    }

    USERS {
        uuid id PK
        varchar email UK
        text password_hash
        varchar role "owner 또는 staff"
        varchar name
        uuid store_id FK "사장님은 매장 만들기 전엔 null"
        timestamptz email_verified_at "null이면 미인증"
        timestamptz created_at
    }

    EMAIL_VERIFICATION_TOKENS {
        uuid id PK
        uuid user_id FK
        text token_hash "원문 대신 해시만 저장"
        timestamptz expires_at
        timestamptz created_at
    }

    REFRESH_TOKENS {
        uuid id PK
        uuid user_id FK
        text token_hash
        timestamptz expires_at
        timestamptz revoked_at "채워지면 무효화된 토큰"
        timestamptz created_at
    }

    STORE_RULES {
        uuid id PK
        uuid store_id FK
        varchar category
        text raw_text "사장님이 입력한 규정 원문 그대로"
        varchar source "text 또는 photo"
        timestamptz created_at
    }

    SCENARIOS {
        uuid id PK
        uuid store_id FK
        varchar type "delay / out_of_stock / rule_violation"
        varchar title
        json persona
        json initial_state
        timestamptz created_at
    }

    RUBRICS {
        uuid id PK
        uuid scenario_id FK
        json criteria "채점 기준 배열"
        int version
        timestamptz approved_at "null이면 승인 전 초안"
        timestamptz created_at
    }

    TRAINING_SESSIONS {
        uuid id PK
        uuid store_id FK
        uuid scenario_id FK
        varchar staff_label "리포트용 별칭"
        varchar status "in_progress / completed"
        timestamptz started_at
        timestamptz completed_at
    }

    SESSION_TURNS {
        uuid id PK
        uuid session_id FK
        int turn_number
        text customer_message
        text staff_answer
        json evaluation "충족여부/빠진기준/피드백/개선문장"
        boolean passed
        int retry_count
        timestamptz created_at
    }
```

## 표마다 뭘 위한 건지

- **`stores`** — 매장 하나. `link_key`는 이제 로그인 대신 "알바 초대 링크"로만 쓰인다.
- **`users`** — 사장님/알바 계정. `role`로 구분. 사장님은 회원가입 직후엔 `store_id`가 비어있다가 매장을 만들면 채워지고, 알바는 사장님이 대시보드에서 계정을 만들어줄 때 바로 채워진다.
- **`store_rules`** — 사장님이 입력한 규정 원문. 나중에 루브릭을 다시 만들 때 원문이 필요해서 변환 후에도 지우지 않는다.
- **`scenarios`** — 카페 시나리오 3종(지연/품절/규칙위반). 매장마다 각각 하나씩 생긴다.
- **`rubrics`** — 시나리오별 채점 기준. `approved_at`이 비어있으면 AI가 막 만든 초안, 채워지면 승인된 것. 사장님이 내용을 수정하면 다시 `null`로 돌아간다(수정된 내용이 승인 안 된 채로 쓰이면 안 되니까).
- **`training_sessions`** — 알바 1명이 시나리오 1개에 도전한 한 판.
- **`session_turns`** — 그 한 판 안에서 "손님 발화 → 알바 답변 → 채점" 한 턴씩의 기록.
- **`email_verification_tokens`** — 사장님 회원가입 시 보낸 인증 메일의 토큰. 한 번 쓰면(또는 만료되면) 더 이상 못 쓴다.
- **`refresh_tokens`** — 로그인 상태를 오래 유지하기 위한 재발급용 토큰. `revoked_at`이 채워지면 무효 — 로그아웃하거나, 이미 쓴 토큰이 재사용되면(도난 의심) 여기에 시각이 찍힌다.

## 확인하는 법

같은 DB를 보는 창구가 두 개 있다 — 어느 쪽으로 봐도 데이터는 동일하다.

- **Supabase 대시보드**: supabase.com 프로젝트 → Table Editor(스프레드시트처럼 보기) / SQL Editor(쿼리 직접 실행).
- **Prisma Studio**: 로컬에서 `cd server && npx prisma studio` → `localhost:5555`.
