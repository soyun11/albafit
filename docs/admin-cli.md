# admin-cli.md — 관리자용 로컬 CLI

> `docs/rubric-reuse.md`와 같은 방식으로 기록한다. 2026-07-27 대화 — "테스트 계정 만들기·비밀번호 재설정·계정 삭제를 매번 스크래치 스크립트로 짜지 말고 도구로 만들어달라"는 요청.

## 왜 만들었나

이번 세션 내내 검증할 때마다 `server/scratch-cleanup-*.mjs` 같은 1회용 스크립트를 그때그때 새로 짜고 지웠다. 비밀번호는 bcrypt 해시라 DB에서 절대 읽을 수 없다는 점(설계상 의도된 것) 때문에, 관리자(개발자 본인)가 테스트하거나 계정을 정리하려면 "새 비밀번호로 덮어쓰기"·"직접 삭제" 같은 DB 쓰기 작업을 자유롭게 할 수 있어야 한다.

## 결정

| 논점 | 결정 | 이유 |
|---|---|---|
| 형태 | 배포된 웹 화면이 아니라 **로컬 CLI 스크립트**(`server/scripts/admin.mjs`) | 웹 화면으로 만들면 `role: 'admin'` 같은 새 권한 체계를 스키마·인증에 추가해야 하고, 계정 삭제 기능이 실제 배포 도메인(`albafit.kr`)에 새로 노출되어 보안 표면이 커진다. 로컬에서 `server/.env`의 `DATABASE_URL`로 직접 붙는 CLI는 새 인증 체계가 필요 없고 배포 위험도 없다 — 이번 챌린지 스코프(4주차, 데모 준비)에도 이 편이 맞다 |
| DB 접근 방식 | HTTP로 `localhost:4000` API를 호출하지 않고, **Prisma를 직접 사용**(`hashPassword`, `generateLinkKey`, `seedDefaultScenarios` 등 기존 lib 함수 재사용) | API 방식은 dev 서버가 떠 있어야 하고, 프로덕션 DB를 대상으로 쓸 땐 더 번거롭다. lib 함수를 그대로 재사용하면 로직 중복 없이 실제 서비스와 같은 방식으로 해시·시딩된다 |
| 삭제 시 연쇄 정리 | `Store` 삭제는 스키마의 `onDelete: Cascade`(storeRules/scenarios/rubrics/trainingSessions/sessionTurns)에 그대로 맡기고, **User는 스키마상 Cascade 대상이 아니라서**(Store 삭제 시 `storeId`만 `SetNull`) 스크립트가 직접 지운다 — 사장님 계정을 지울 땐 그 매장의 알바 계정들도 같이 지운다 | 스키마에 이미 있는 cascade를 활용하면 오늘 썼던 6단계짜리 수동 삭제 스크립트가 필요 없어진다. User cascade가 없는 이유(`SetNull`)는 "매장이 없어져도 계정 자체는 남아야 한다"는 기존 설계라, 계정을 진짜로 지우고 싶을 땐 스크립트가 명시적으로 지운다 |
| 삭제 확인 | `--yes` 플래그 없이 실행하면 무엇이 지워질지만 보여주고 실제로는 안 지운다 | 되돌릴 수 없는 작업이라 실수로 한 번에 날리는 걸 막는다 |
| 비밀번호 재설정 | 현재 비밀번호를 몰라도(`PATCH /api/auth/password`와 달리) 이메일만 알면 바로 새 비밀번호로 덮어쓴다 | 관리자 도구의 존재 이유 자체가 "비밀번호를 잊었을 때 DB에 직접 접근해 재설정"이므로, 앱의 자기 서비스 흐름(현재 비밀번호 필요)과 같은 제약을 걸 이유가 없다 |
| 조회 명령 | `list` 명령으로 매장별 사장님·알바 이메일 목록을 보여준다(비밀번호는 절대 안 보여줌) | "이메일을 어떻게 확인하나"라는 원래 질문에 Supabase 대시보드를 안 열어도 바로 답할 수 있게 |

## 사용법

```bash
cd server

# 매장별 사장님·알바 이메일 목록
node scripts/admin.mjs list

# 테스트 매장 만들기(사장님 + 매장 + 기본 시나리오, 알바는 선택)
node scripts/admin.mjs create-test-store --owner-email a@test.com --owner-password test1234 --industry cafe \
  --staff-email b@test.com --staff-password test1234

# 비밀번호 재설정 (현재 비밀번호 불필요)
node scripts/admin.mjs reset-password --email a@test.com --password newpass123

# 계정 삭제 — 먼저 --yes 없이 실행하면 무엇이 지워질지만 보여줌
node scripts/admin.mjs delete-account --email a@test.com
node scripts/admin.mjs delete-account --email a@test.com --yes
```
