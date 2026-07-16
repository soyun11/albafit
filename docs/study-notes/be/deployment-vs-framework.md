# 프레임워크 vs 배포 플랫폼

Express/React는 "무엇으로 짰는지"(코드), Railway/Vercel은 "그 코드를 어디서 24시간 돌아가게 하는지"(호스팅)다. 대체 관계가 아니라 코드 → 배포 대상으로 이어지는 관계.

- Express로 짠 백엔드 코드(`server/src/index.js`)를 Railway에 올려야 내 컴퓨터가 꺼져도 계속 돌아가고, 남들이 URL로 접속할 수 있다.
- React로 짠 프론트 코드(`src/App.jsx`)를 Vercel에 올려야 실제 URL로 배포된다.
- 지금은 둘 다 로컬(`localhost:4000`, `localhost:5173`)에서만 돌아가는 상태 — 코드는 이미 완성돼 있어도 "배포"는 별개로 아직 안 한 것.

DB도 같은 구조다: Prisma/PostgreSQL이 "무엇으로 짰는지"이고, Supabase가 "그 DB를 어디서 호스팅하는지"다.
