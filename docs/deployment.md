# deployment.md — 배포 실행 계획 (2026-07-22)

> `docs/checklist.md` 4주차 "배포" 절의 실행 기록. 원래 계획은 백엔드 Railway + 프론트 Vercel + DB Supabase였는데, 실제로는 **프론트+백엔드 전부 Vercel**로 배포했다. 아래에 왜 바뀌었는지, 어떻게 붙였는지를 남긴다.

## 변경 이력 — 백엔드 호스팅 Railway → Vercel 전환 (2026-07-22)

부스 전시 신청에 쓸 QR 링크가 급해서 배포를 원래 일정(체크리스트 3주차 목요일)보다 하루 당겨 진행했다. Railway로 먼저 시도했으나 두 가지 문제를 겪고 Vercel 풀스택으로 방향을 틀었다.

### Railway에서 겪은 문제 (기각)

1. **계정 인증**: Railway는 더 이상 완전 무료가 아니다. 새 계정은 Hobby 플랜($5/월, 카드 등록) 또는 전화번호 인증 Trial이 필요하고, 인증 전엔 빌드 자체가 스케줄링 단계에서 조용히 실패한다(로그가 아예 안 남음). Hobby 결제 후에도 같은 증상이 이어졌다.
2. **`railway up` 업로드 버그**: `server/` 디렉터리(node_modules 제외 실제 약 380KB, `git archive`로 검증)를 업로드하는데 매번 96~97KB만 번들링됐다. `.gitignore` 유무·`--no-gitignore` 옵션과 무관하게 항상 같은 크기라 이 프로젝트 설정 문제가 아니라 CLI 자체의 문제로 판단(`prisma/`, `eval/`, `package-lock.json`이 통째로 빠지는 것으로 추정). 결국 Railway 결제까지 했지만 실제로는 못 씀 — **Railway Hobby 구독이 남아있으면 안 쓸 경우 취소할 것.**

### Vercel 풀스택으로 전환한 이유

Vercel Serverless Function으로 Express 앱을 그대로 올릴 수 있고, `vercel deploy` CLI 업로드는 위 버그 없이 정상 동작했다. 프론트와 백엔드가 같은 도메인이 되어 CORS 설정도 단순해진다는 부수 이점도 있었다.

## 구현

- **`server/src/app.js`(신규)**: 기존 `server/src/index.js`에 있던 Express 앱 정의(미들웨어·라우터 등록)를 그대로 옮기고 `app.listen(...)` 호출만 뺐다. `export default app`.
- **`server/src/index.js`**: `app.js`를 import해서 `app.listen(...)`만 하는 얇은 진입점으로 축소 — 로컬 `npm run server:dev`는 그대로 이 파일을 쓴다.
- **`api/index.js`(신규, 저장소 루트)**: `import app from '../server/src/app.js'; export default app` — Vercel이 이 파일을 Node.js 서버리스 함수로 인식한다.
- **`vercel.json`(신규)**:
  ```json
  {
    "installCommand": "npm install && npm install --prefix server",
    "rewrites": [{ "source": "/api/:path*", "destination": "/api" }]
  }
  ```
  - `installCommand`를 루트+`server/` 양쪽 다 설치하게 확장 — `server/`가 워크스페이스가 아니라 독립 `package.json`(CLAUDE.md 결정)이라 기본 설치만으로는 `server/node_modules`가 안 생긴다. Vercel의 트레이스 기반 번들링(`@vercel/nft`)이 빌드 시점에 `server/node_modules`를 찾아서 함수에 포함시키므로, 워크스페이스 전환 없이도 동작한다.
  - **`rewrites` 필수 이유**: 처음엔 `api/[...path].js`(파일명 기반 catch-all 컨벤션)로 시도했는데, `/api/health`(세그먼트 1개)는 되고 `/api/stores/x`(세그먼트 2개 이상)는 Vercel 자체 404(`NOT_FOUND`)로 막혔다 — 함수까지 요청이 아예 안 옴. 이 환경에서 bracket catch-all이 다중 세그먼트를 못 잡는 걸 확인하고, `api/index.js` 고정 파일 + `vercel.json`의 명시적 `rewrites`(`/api/:path*` → `/api`)로 바꾸니 정상 동작했다.
- **`server/package.json`**: `"postinstall": "prisma generate"` 추가 — Vercel 빌드 환경(리눅스)에서 Prisma 엔진 바이너리가 그 자리에서 새로 생성되게 함(로컬 macOS에서 생성된 바이너리를 그대로 올리면 안 맞음).
- **`server/.gitignore`(신규)**: `node_modules`, `.env` — `server/`가 루트와 별개 디렉터리라 루트 `.gitignore`만으로는 커버 안 됨.
- **프론트 API 주소**: `VITE_API_BASE_URL`을 빈 문자열로 설정 — 프론트·백엔드가 같은 Vercel 배포/도메인이라 `fetch('/api/...')`처럼 상대경로로 그대로 붙는다.

## 환경변수 (Vercel 프로젝트, Production)

`server/.env`에 있던 값을 그대로 Vercel에 등록했다: `DATABASE_URL`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `JWT_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`. `FRONTEND_URL`/`CORS_ORIGIN`은 커스텀 도메인(`https://albafit.kr`)으로 설정 — 값은 CLI에서 `--stdin`으로만 넣어서 터미널 로그에 노출된 적 없음.

## 검증 (2026-07-22, 브라우저 실제 확인)

배포된 `https://hub-ten-virid.vercel.app`에서 전체 흐름을 처음부터 끝까지 직접 클릭해서 확인했다: 랜딩 → "매장 없이 체험하기" → 업종 선택(카페) → 시나리오 선택(음료 지연) → 규칙 입력 → **AI(Gemini)가 실제 루브릭 생성**(좋은예/나쁜예 포함) → **AI 손님(OpenAI)과 실제 대화** → 답변 제출 → **평가 에이전트가 실시간 채점**(2/2 충족, 피드백 문장까지) → 다음 시나리오로 진행. 콘솔 에러 없음. 이걸로 `OPENAI_API_KEY`/`GEMINI_API_KEY`/`DATABASE_URL` 전부 프로덕션에서 정상 동작 확인.

기존에 브라우저 검증용으로 만들어둔 사장님/알바 계정(`browsercheck-owner-*`, `browsercheck-staff-*`)으로 로그인도 확인 — 같은 Supabase DB를 로컬 개발과 프로덕션이 공유하므로 그대로 재사용 가능했다.

## 커스텀 도메인 (진행 중)

`albafit.kr`(가비아 등록, Resend 이메일 발신 인증에 이미 쓰던 도메인)을 `vercel domains add`로 프로젝트에 연결 신청함. 가비아 DNS에 `A albafit.kr → 76.76.21.21` 레코드를 추가해야 최종 연결된다(네임서버 통째로 바꾸는 대안도 있으나 A레코드가 더 간단해서 권장 경로로 안내). 연결 전까지는 `https://hub-ten-virid.vercel.app`를 QR·데모 링크로 쓴다.

## 남은 것

- 가비아 DNS A레코드 추가 → `vercel domains inspect albafit.kr`로 연결 확인
- 안 쓰게 된 Railway 프로젝트(`albafit-server`)·Hobby 구독 정리 여부 결정
- `CLAUDE.md`의 "배포 대상" 절, `docs/checklist.md`의 Railway 관련 항목을 이 문서 기준으로 갱신 (별도 커밋)
