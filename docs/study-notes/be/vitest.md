# Vitest

## 이게 뭔지

테스트 러너다. "이 함수에 이 값을 넣으면 이 결과가 나와야 한다"를 코드로 적어두고, 그 코드들을 한 번에 실행해서 맞았는지 틀렸는지 알려주는 도구.

지금까지는 기능을 만들고 나서 브라우저나 Postman으로 직접 눌러보며 확인했다. 그건 확인할 때마다 사람이 손으로 다시 해야 하고, 나중에 다른 코드를 고치다가 예전에 만든 기능이 조용히 망가져도(=회귀 버그) 눈치채기 어렵다. 테스트를 코드로 적어두면 그걸 자동으로, 몇 초 만에, 몇 번이고 다시 확인할 수 있다.

## 왜 이 프로젝트에서 Vitest인지

`CLAUDE.md`에 이미 정해져 있는 이유:

- 프론트가 Vite 스택이라 Vitest가 설정 없이 바로 궁합이 맞는다.
- 백엔드도 (지금 단계에서는) DB·외부 API를 감싸는 순수 API 호출 로직이 많아서, 프론트와 같은 러너를 그대로 재사용할 수 있다 — 백엔드 전용 러너(Jest 등)를 따로 설정할 이유가 없다.
- 2주차까지는 "코어 로직"(A/B 에이전트, 채점 로직) 자체가 없어서 테스트할 대상이 없었고, 3주차부터 `server/src/lib/`에 실제 로직이 생기면서 도입 시점이 됐다.

## 핵심 개념 3가지

```js
import { describe, it, expect } from 'vitest'
import { computeHearts } from './sessionTurns.js'

describe('computeHearts', () => {
  it('새로 충족한 기준이 있으면 하트를 깎지 않는다', () => {
    const result = computeHearts({ metItemsThisTurn: ['greeting'], previousHearts: 3 })
    expect(result).toBe(3)
  })

  it('엉뚱한 답이면(새로 충족한 기준 없음) 하트를 깎는다', () => {
    const result = computeHearts({ metItemsThisTurn: [], previousHearts: 3 })
    expect(result).toBe(2)
  })
})
```

- **`describe`** — 테스트를 묶는 단위. 보통 함수 하나(또는 기능 하나)당 하나씩 만든다. 없어도 동작은 하지만, 테스트 개수가 늘면 결과 로그를 읽기 힘들어져서 관례적으로 씌운다.
- **`it`** (= `test`, 둘은 완전히 같은 함수의 다른 이름) — "이러이러한 상황이면 이런 결과가 나와야 한다"를 하나씩 적는 단위. 이름은 "~한다"처럼 사람이 읽었을 때 뭘 검증하는지 바로 알 수 있게 짓는다.
- **`expect`** — 실제로 나온 값을 검증하는 부분. `expect(실제값).toBe(기대값)`처럼 쓴다. `.toBe`(원시값 일치), `.toEqual`(객체/배열 내용 비교), `.toThrow`(에러 발생 확인) 같은 매처(matcher)가 여러 개 있다.

이 셋만 알면 순수 함수 테스트는 거의 다 쓸 수 있다.

## `globals: true`를 켜지 않은 이유

Vitest는 설정에서 `test.globals: true`를 켜면 `describe`/`it`/`expect`를 매 파일마다 import 안 하고 전역 변수처럼 바로 쓸 수 있게 해준다 (Jest는 기본이 이 방식). 그런데 이 프로젝트는 켜지 않기로 했다.

이유는 lint(`.oxlintrc.json`) 때문이다. `describe`/`it`/`expect`를 전역 변수로 쓰면 oxlint 입장에서는 "선언되지 않은 변수를 쓴다"고 에러를 낸다. 이걸 해결하려면 `server/**/*.test.js` 전용으로 vitest 전역 변수를 lint 설정에 추가해야 하는데, 그냥 매 테스트 파일 맨 위에 `import { describe, it, expect } from 'vitest'`를 한 줄 적으면 애초에 전역 변수를 쓰는 게 아니게 되어 lint 설정을 건드릴 필요가 없어진다. 설정 파일 하나를 덜 건드리는 쪽을 택한 것.

## 실행 방식: `run` vs watch 모드

- `vitest run` — 테스트를 한 번 실행하고 끝낸다. CI나 "지금 통과하는지만 확인"할 때 쓴다. 이 프로젝트의 `npm test` 스크립트가 이 모드다.
- `vitest` (인자 없이) — watch 모드. 파일을 저장할 때마다 관련 테스트를 자동으로 다시 돌려준다. 코드를 짜면서 옆에 켜두고 쓰는 용도. 별도 npm 스크립트로 안 박아두고, 필요할 때 로컬에서 `npx vitest`로 직접 켠다.

## Mock은 언제 필요한가

순수 함수(입력을 넣으면 외부 상태에 관계없이 같은 출력이 나오는 함수)는 mock 없이 바로 테스트할 수 있다. `server/src/lib/sessionTurns.js`의 `pickFinalAttempts`/`computeHearts`가 여기 해당 — 그냥 배열 넣고 리턴값을 확인하면 된다.

반대로 `rubric.js`/`evaluator.js`/`customerAgent.js`처럼 내부에서 실제 OpenAI·Gemini API를 호출하는 함수는 테스트할 때마다 진짜로 API를 호출할 수는 없다 (느리고, 돈이 들고, 응답이 매번 달라진다). 이럴 때 `vi.mock()`으로 "이 API 클라이언트를 부르면 실제로 호출하지 말고 내가 정해준 가짜 응답을 리턴해라"라고 대체해준다. 이건 4주차 초반, 루브릭 재사용성 기능을 TDD로 구현할 때 처음 쓰게 될 예정.

## 관련 개념

- (예정) 루브릭 재사용성 TDD 노트 — `vi.mock()`으로 Gemini 호출을 대체하는 실제 예시
