---
name: test-writer
description: albafit(매장 맞춤 알바 훈련 서비스) 프로젝트의 Vitest 테스트 작성 규칙. server/src/lib에 새 순수 함수를 추가·수정하거나, prisma/openai/gemini처럼 외부 의존이 있는 로직을 처음 테스트하거나, TDD로 새 기능을 시작할 때 이 스킬을 먼저 읽는다. 파일 위치·mock 패턴·케이스 설계 체크리스트를 담고 있다.
---

# albafit 테스트 작성 (Vitest)

## 언제 쓰나
- `server/src/lib/`에 새 순수 함수를 만들거나 기존 함수를 고칠 때
- `prisma`/`openai`/`gemini` 클라이언트를 부르는 함수를 처음 테스트할 때 (mock이 필요한 경우)
- TDD로 새 기능을 시작할 때 — 구현보다 테스트를 먼저 쓸 때

## 원칙 1 — 순수 함수부터 분리한다
DB·LLM 호출이 섞인 코드를 그대로 테스트하지 않는다. "입력을 넣으면 외부 상태와 무관하게 같은 출력이 나오는" 부분만 별도 함수로 뽑아서 그 함수만 테스트한다.

레퍼런스: `server/src/lib/sessionTurns.js` + `sessionTurns.test.js` — `pickFinalAttempts`/`computeHearts`는 배열을 받아 배열/객체를 리턴할 뿐 DB를 모른다. 라우트(`routes/*.js`)는 이 순수 함수를 호출하는 얇은 껍데기로만 남긴다.

## 원칙 2 — 파일 위치·실행 규칙
- 테스트 파일은 소스 파일 바로 옆에 `이름.test.js`로 둔다 (`sessionTurns.js` 옆 `sessionTurns.test.js`).
- `vitest.config.js`에 `test.globals: true`를 켜지 않았다 — 이유는 lint(`.oxlintrc.json`)가 `describe`/`it`/`expect`를 전역 변수로 인식 못 해 에러를 내기 때문. 그래서 **매 테스트 파일 맨 위에 명시적으로 import**한다:
  ```js
  import { describe, it, expect, vi } from 'vitest'
  ```
- 실행: `cd server && npm test` (= `vitest run`, 1회 실행 후 종료 — CI/커밋 전 확인용). 짜면서 옆에 켜두고 싶으면 `npx vitest`(watch 모드, 별도 스크립트로 안 박아둠).
- 세미콜론 없음, ESM — 프로젝트 전체 컨벤션 그대로 테스트 코드에도 적용.

## 원칙 3 — 테스트 피라미드 (이 프로젝트 기준)
아래로 갈수록 많이, 위로 갈수록 적게.

| 레벨 | 대상 | mock 여부 |
|---|---|---|
| 단위(70~80%) | `server/src/lib/`의 순수 함수 | mock 없음 |
| 통합 | 라우트(`routes/*.js`) 단위 — 예: "두 번째 매장이 제출하면 Gemini가 실제로 호출 안 되는지" | DB는 그대로 쓰고 **외부 API(openai/gemini)만** `vi.mock` |
| E2E | 브라우저 실제 클릭 | 이 챌린지 범위에서는 생략 (시간 대비 이득 적음, 필요하면 `feature-verifier` 에이전트로 대체) |

## 단위 테스트 템플릿 (mock 없음)
```js
import { describe, it, expect } from 'vitest'
import { 함수 } from './파일.js'

describe('함수이름', () => {
  it('정상 케이스: ~하면 ~한다', () => {
    const input = [/* 서로 값이 겹치지 않게 */]
    const result = 함수(input)
    expect(result).toBe(기대값) // 원시값: toBe, 객체/배열 내용 비교: toEqual
  })

  it('경계값: 빈 입력이면 ~한다', () => {
    expect(함수([])).toEqual(기대값)
  })
})
```

## 케이스 설계 체크리스트 (실제로 겪은 실수 기반)
- **정상 케이스 + 경계값(빈 배열/빈 문자열/후보 0개) 최소 1개씩.**
- **테스트 데이터는 서로 다른 값으로 넣는다.** 두 항목을 똑같은 문자열(`'...'` 등)로 넣으면 순서·개수는 맞아도 "값이 제대로 조합됐는지"는 증명되지 않는다. 서로 구분되는 값을 넣고 `result[i].text`까지 확인해야 진짜 검증이다.
- **인덱스 기반 assertion은 소스 로직을 먼저 확인하고 쓴다.** "몇 번째에 뭐가 와야 하는지"는 감으로 적지 않고, 함수가 실제로 어떤 순서로 값을 넣는지 코드를 보고 결정한다.
- 오타·필드명 불일치는 문법 에러가 안 나서 코드 리뷰로 안 잡힌다 — `undefined`가 나오면 필드명부터 의심.

## Mock 템플릿 (DB/외부 API 의존 함수)
`prisma`(`server/src/lib/prisma.js`)와 `gemini`(`server/src/lib/gemini.js`)/`openai`(`server/src/lib/openai.js`)는 전부 **default export 싱글턴**이라 아래 형태로 모킹한다.

```js
import { describe, it, expect, vi } from 'vitest'

vi.mock('../lib/prisma.js', () => ({
  default: {
    scenario: { findMany: vi.fn(), create: vi.fn() },
    rubric: { create: vi.fn() },
  },
}))

vi.mock('../lib/gemini.js', () => ({
  default: { models: { generateContent: vi.fn() } },
}))

import prisma from '../lib/prisma.js'
import gemini from '../lib/gemini.js'
import { 대상함수 } from './대상.js'

describe('대상함수', () => {
  it('유사한 후보가 있으면 Gemini를 호출하지 않는다', async () => {
    prisma.scenario.findMany.mockResolvedValue([{ /* 후보 데이터 */ }])

    await 대상함수(/* ... */)

    expect(gemini.models.generateContent).not.toHaveBeenCalled()
  })
})
```
- `vi.mock`은 파일 맨 위(호이스팅됨)에 두고, mock 대상 모듈은 `vi.mock` 아래에서 다시 import해서 각 테스트 안에서 `mockResolvedValue`/`mockReturnValue`로 반환값을 지정한다.
- 매 `it` 실행 전 반환값이 이전 테스트에서 새 값으로 덮였는지 신경 쓴다 — 필요하면 `beforeEach(() => vi.clearAllMocks())`.

## 커밋 전 체크리스트
- [ ] `cd server && npm test` 통과
- [ ] 루트에서 `npm run lint` 통과 (server 포함 전체 대상)
