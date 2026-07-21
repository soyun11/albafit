import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // server/는 독립된 package.json·vitest 설정을 가진 별개 프로젝트라(server/vitest.config.js,
    // `npm run server:test`) 여기서 같이 돌리지 않는다 — 안 빼면 기본 exclude에 node_modules만
    // 있어서 server/src의 *.test.js까지 중복으로 실행된다.
    exclude: ['**/node_modules/**', 'server/**'],
  },
})
