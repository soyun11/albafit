# db-migration-plan.md — DB 마이그레이션 실행 계획

> [db-schema.md](./db-schema.md)에 이미 설계된 스키마를 실제 Postgres에 올리기 위한 실행 계획. [checklist.md](./checklist.md) 2주차 "7/13 — DB 마이그레이션 + 매장 링크 발급/조회 API" 중 **마이그레이션 실행 부분**만 다룬다 (매장 링크 API 2개는 별도 작업).

## 변경 이력 — DB 제공자 Railway → Supabase 전환 (2026-07-13)

이번 주 공식 과제 요구사항이 "Supabase 한 테이블에 데이터 저장·조회"를 명시해, 아래 "선택 근거" 절에서 한 번 기각했던 Supabase를 DB 제공자로 다시 채택한다. 기각 사유(로그인 없는 구조라 Auth·Storage가 과함)는 여전히 유효하지만, 과제 요구사항이 우선이라 이번엔 뒤집는다. **Express 백엔드는 그대로 Railway에 남기고 DB만 Supabase Postgres로 분리**한다 — Prisma가 표준 `postgresql` provider + `DATABASE_URL`만 쓰므로 `schema.prisma`/`prisma.config.js`/`src/lib/prisma.js` 코드 변경 없이 연결 문자열만 Supabase 것으로 바꾸면 된다.

아래 "실행 완료" 절의 내용은 Railway Postgres 기준으로 이미 진행했던 첫 실행 기록이며 그대로 남겨둔다.

## Supabase 재적용 완료 (2026-07-13)

Supabase 프로젝트(`aws-1-ap-northeast-2` 리전) 생성 후 `server/.env`의 `DATABASE_URL`을 session-mode pooler 연결 문자열로 교체하고 `npx prisma migrate deploy`로 기존 `20260713082346_init` 마이그레이션을 그대로 적용했다 (새 마이그레이션 생성 아님, 기존 이력 재적용). 코드 변경은 없었다.

- `npx prisma migrate status` → 1개 미적용 마이그레이션 확인 → `npx prisma migrate deploy` → 정상 적용
- Express 서버를 로컬에서 띄우고 실제 API로 스모크 테스트: `POST /api/stores`(생성) → `GET /api/stores/:linkKey`(조회, 생성된 값과 일치) → `GET /api/stores/doesnotexist`(404) 전부 기대대로 동작 확인
- 이걸로 이 문서 상단 "변경 이력"에서 남겨뒀던 후속 작업(Supabase 재적용)이 완료됨

## 실행 완료 (2026-07-13, Railway 기준 — 최초 실행 기록)

아래 계획대로 Railway Postgres에 6개 테이블 마이그레이션을 실행하고 CRUD 스모크 테스트까지 통과했다. 실행 중 발견한 중요한 변경사항:

- **Prisma 7은 `schema.prisma`의 `datasource { url = env("DATABASE_URL") }` 방식을 더 이상 지원하지 않는다.** Migrate CLI용 연결 정보는 `server/prisma.config.js`로, `PrismaClient` 런타임 연결은 **driver adapter**(`@prisma/adapter-pg` + `pg`)로 분리해야 한다. 이 프로젝트는 TypeScript를 쓰지 않으므로 `prisma.config.js`(ESM)로 작성했다.
  - `server/prisma/schema.prisma`의 datasource 블록에서 `url` 줄 제거 (`provider = "postgresql"`만 남김)
  - `server/prisma.config.js` 신규 — `defineConfig({ schema, datasource: { url: process.env.DATABASE_URL } })`
  - `server/src/lib/prisma.js` 신규 — `new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL) })`
  - `@prisma/adapter-pg`, `pg` 의존성 추가
- `gen_random_uuid()`는 Railway Postgres에서 별도 `pgcrypto` 확장 활성화 없이 바로 동작했다 (아래 4번 조건부 작업 불필요 — `CREATE TABLE` 자체가 함수 존재 여부를 검증하는데 에러 없이 통과함).
- 6개 테이블 마이그레이션(`20260713082346_init`) 적용 완료, `db-schema.md` DDL과 대조해 `link_key` UNIQUE·`approved_at` nullable·FK cascade 규칙 모두 일치 확인.
- CRUD 스모크 테스트(임시 스크립트, 실행 후 삭제): Store→StoreRule→Scenario→Rubric→TrainingSession→SessionTurn 순 insert/select, JSONB(`persona`, `evaluation`) 왕복, cascade delete까지 정상 동작 확인.
- 로컬과 Railway가 같은 Postgres 인스턴스라 별도 "프로덕션 적용"(10번)은 이번엔 불필요 — `prisma:migrate:deploy` 스크립트만 미리 준비해두고, 실제로는 Express가 Railway에 배포되는 3~4주차 시점에 빌드 단계에서 사용한다.
- 아직 하지 않은 것: PR 생성(11번)은 사용자 확인 후 진행 예정.

## 선택 근거 (비교안)

### DB 제공자: Railway vs 대안 (2026-07-13 Supabase로 재결정 — 위 "변경 이력" 참고)

| 옵션 | 장점 | 단점 | 채택 여부 |
|---|---|---|---|
| Railway | Postgres+Express를 한 프로젝트에서 관리, git push 시 자동 배포, 설정 거의 없음 | 트래픽 커지면 비용 상승 | ~~채택~~ → 기각 (DB만, Express는 유지) |
| **Supabase** | Postgres+Auth+Storage 풀패키지, 과제 요구사항이 명시 | 로그인 없는 구조라 Auth 등 부가기능은 당장 불필요(과함) — 그래도 DB만 쓰면 무방 | **채택 (DB만)** |
| AWS RDS+EC2 | 세밀한 제어, 확장성 | VPC·보안그룹 등 운영 설정이 4주 챌린지엔 과도 | 기각 |
| Heroku | 익숙함 | 무료 티어 사실상 폐지, 비용 대비 이점 없음 | 기각 |
| 로컬 Postgres만 사용 | 즉시 개발 가능 | 배포·팀 공유 불가, 결국 나중에 클라우드로 옮겨야 함 | 기각 |

**결론**: 애초엔 "설정 최소화 + Postgres·백엔드 한곳에서 관리"를 최우선으로 봐서 Railway를 택했으나, 과제 요구사항이 Supabase를 명시해 DB만 Supabase로 옮긴다. Express 백엔드 호스팅은 Railway를 그대로 유지 — Supabase는 상시 실행 서버가 아니라 서버리스(Edge Functions, Deno 런타임) 중심이라 Express를 그대로 옮길 수 없다.

### DB 스키마: JSONB 하이브리드 vs 대안

| 옵션 | 장점 | 단점 | 채택 여부 |
|---|---|---|---|
| **관계형 6테이블 + JSONB 컬럼(채택)** | FK로 무결성 보장(매장→규칙→시나리오 등), 구조가 시나리오마다 다른 값(루브릭 criteria, persona, evaluation)은 JSONB로 유연하게 | JSONB 내부 검색은 상대적으로 느림(현재 규모에선 무관) | **채택** |
| 완전 정규화(루브릭 항목별 테이블 등) | 데이터 일관성 최고 | 루브릭 항목 구조가 매장·시나리오마다 달라 스키마 변경/조인이 잦아짐 | 기각 |
| MongoDB 등 문서형 DB | 스키마 자유도 최고 | 매장→세션→턴의 관계·집계(사장님 리포트)에 SQL JOIN이 필요, FK 무결성 없음 | 기각 |

**결론**: 데이터 대부분이 "매장이 루트, 나머지는 그 아래 매달리는" 명확한 관계형 구조이므로 FK가 필요하지만, 루브릭/평가 결과처럼 항목 수·모양이 매번 달라지는 부분만 JSONB로 빼서 매 변경마다 스키마 마이그레이션하지 않게 한 것 — 관계형과 유연성을 동시에 취한 절충안.

## 현재 상태 (실행 전 기준 — 아래는 계획 수립 시점 스냅샷)

- `server/prisma/schema.prisma`에 `db-schema.md` 설계를 그대로 옮긴 6개 모델(Store, StoreRule, Scenario, Rubric, TrainingSession, SessionTurn)이 이미 작성돼 있다.
- `server/prisma/migrations/` 폴더 자체가 없다 — `prisma migrate dev`가 한 번도 실행된 적 없다.
- `server/package.json`에 `prisma:generate`/`prisma:migrate`(`migrate dev`) 스크립트는 이미 정의돼 있다. `migrate deploy`(프로덕션용)는 아직 없다.
- `server/.env.example`은 있으나 실제 `server/.env`(`DATABASE_URL` 등)는 로컬에도 없다 — 실제 DB에 연결해본 적이 아직 없다.
- `server/src/index.js`는 express 앱 + `/api/health` 헬스체크만 있고, Prisma Client 연결 코드는 없다. `server/src/lib/`는 빈 디렉토리다.

## 사전 확인 필요 사항

- 모든 PK가 `@default(dbgenerated("gen_random_uuid()"))`를 쓴다 — Postgres에 `gen_random_uuid()` 함수(pgcrypto 확장 또는 PG13+ 내장)가 있어야 한다. Railway 제공 Postgres 버전에서 기본 제공 여부를 실행 전에 확인해야 한다.
- Railway 프로젝트의 Postgres 애드온이 아직 없다고 가정한다. 이미 있다면 해당 단계는 "생성"이 아니라 "확인"으로 대체한다.

## 작업 목록 (우선순위·의존관계 순)

| # | 작업 | 우선순위 | 의존 | 비고 |
|---|---|---|---|---|
| 1 | Railway Postgres 프로비저닝 | Must | - | Railway 프로젝트에 Postgres 애드온 추가, 접속 정보 확보 |
| 2 | 로컬 `server/.env`에 `DATABASE_URL` 채우기 | Must | 1 | `.env.example` 형식 그대로. `.gitignore`가 이미 `.env`를 무시하므로 커밋 위험 없음 |
| 3 | `gen_random_uuid()` 가용성 확인 | Must | 2 | `psql`/`prisma db execute`로 `SELECT gen_random_uuid();` 실행 — 첫 insert 시점 실패를 피하려면 마이그레이션 전에 확인 |
| 4 | (조건부) `pgcrypto` 확장 활성화 | Must (조건부) | 3 | 함수가 없으면 첫 마이그레이션 SQL에 `CREATE EXTENSION IF NOT EXISTS pgcrypto;`를 포함해 이력화 (로컬·프로덕션 재현성 확보) |
| 5 | `npx prisma migrate dev --name init` 로컬 실행 | Must | 3, 4 | `server/prisma/migrations/`에 최초 이력 생성 + 로컬 DB 적용 + Prisma Client 자동 generate |
| 6 | 마이그레이션 SQL을 db-schema.md DDL과 대조 | Must | 5 | `stores.link_key` UNIQUE, `rubrics.approved_at` nullable, FK `onDelete: Cascade` 여부 확인 (checklist.md 명시 항목) |
| 7 | `server/src/lib/prisma.js` Prisma Client 싱글턴 추가 | Must | 5 | 모듈 스코프에서 한 번만 생성해 export — Node `--watch` 재시작 시 연결 누적 방지 |
| 8 | 6개 테이블 CRUD 스모크 테스트 | Must | 7 | Store→StoreRule→Scenario→Rubric→TrainingSession→SessionTurn 순으로 insert/select, FK·JSONB 왕복 확인 (Vitest 도입 전이라 임시 스크립트로 충분) |
| 9 | `server/package.json`에 `prisma:migrate:deploy` 스크립트 추가 | Should | 5 | `prisma migrate deploy`(비대화형) 명시적으로 정의 — 10번 전에 필요 |
| 10 | Railway 프로덕션 DB에 마이그레이션 적용 | Must | 6, 9 | 환경변수를 Railway `DATABASE_URL`로 전환 후 `prisma migrate deploy` — 로컬에서 검증된 이력만 적용 |
| 11 | PR 생성 + `review` 라벨 부착 | Must | 5~10 | `migrations/**`, `schema.prisma`, `package.json` 변경을 conventional commit으로, PR 템플릿 4개 섹션 작성 |
| 12 | `docs/checklist.md` 체크박스 갱신 | Should | 11 | 마이그레이션 관련 항목만 체크, 매장 링크 API 2개는 미체크 유지 |

## 완료 기준

- Railway Postgres에 6개 테이블이 실제로 존재 (`\dt` 또는 Prisma Studio로 확인)
- `stores.link_key` UNIQUE, `rubrics.approved_at` nullable 확인
- 로컬 CRUD 스모크 테스트에서 6개 테이블 모두 insert/select 성공, JSONB 컬럼(`persona`, `initialState`, `criteria`, `evaluation`) 왕복 확인
- Railway 프로덕션 DB에 `prisma migrate deploy` 적용 후 동일하게 테이블 존재 확인
- 루트 `npm run lint` 통과 (`lib/prisma.js`도 세미콜론 없는 ESM 스타일 유지)

## 참고 — auto-merge 라벨

`.github/workflows/auto-merge.yml`을 확인한 결과, `main`을 타겟하는 PR은 `isTargetingMain` 규칙이 최우선 매칭되어 코멘트만 남기고 자동 머지 대상에서 제외된다. 그래도 관행상 `review` 라벨은 붙여 리뷰를 받는 것을 권장한다.
