# 미들웨어 (Middleware)

## 이게 뭔지

Express 서버는 요청 하나가 들어오면 그걸 바로 "최종 처리 로직"(라우터 핸들러)으로 보내지 않는다. 그 전에 등록해둔 함수들을 순서대로 하나씩 거쳐 가게 만들 수 있는데, 이 중간 함수들을 미들웨어라고 부른다.

미들웨어가 하는 일은 크게 두 가지 중 하나다.
1. 요청을 확인해서 문제가 있으면 여기서 응답을 보내고 끝내버린다 (예: 로그인 안 했으면 401 에러).
2. 요청에 뭔가를 더하거나 가공한 다음, "이상 없음, 다음으로 넘겨"라고 다음 함수에 넘긴다.

## 비유

매장에 배달 주문이 하나 들어왔다고 생각해보자. 이 주문이 완성되기까지 여러 담당자를 순서대로 거친다.

1. **문 앞 담당자** — "이거 우리 가게 배달앱에서 온 주문 맞아?" 확인. 아니면 여기서 바로 돌려보냄.
2. **주문 정리 담당자** — 배달앱에서 온 복잡한 주문 텍스트를 "아메리카노 1잔, 샷 추가"처럼 알아보기 쉬운 형태로 정리해서 다음 사람한테 넘김.
3. **주방** — 정리된 주문을 보고 실제로 음료를 만듦 (= 라우터 핸들러, 진짜 하려던 일).

1번, 2번처럼 **최종 처리(주방) 전에 요청을 가로채서 확인·가공한 다음, 통과시킬지 여기서 끝낼지 정하는 함수**가 미들웨어다. 여러 명을 순서대로 거치는 것처럼, 미들웨어도 등록한 순서대로 실행된다 — 순서를 바꾸면 결과가 달라질 수 있다 (아래 "왜 이 순서로 짰는지" 참고).

## 실제 코드로 보기

`server/src/index.js:10-24`

```js
const app = express()

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }))
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

app.use('/api/auth', authRouter)
app.use('/api/stores', storesRouter)
```

미들웨어 함수는 전부 `(req, res, next)` 세 개를 인자로 받는 모양이다.

- `req` — 들어온 요청 정보 (헤더, body, URL 등)
- `res` — 응답을 보낼 때 쓰는 객체
- `next` — "확인 끝났으니 다음 미들웨어로 넘겨줘"를 호출하는 함수

`server/src/middleware/requireAuth.js:5-19`에 있는 `requireAuth`가 실제 예시다.

```js
export function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? ''
  const [scheme, token] = header.split(' ')

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'authorization token required' })
  }

  try {
    req.user = verifyAccessToken(token)
    return next()
  } catch {
    return res.status(401).json({ error: 'invalid or expired token' })
  }
}
```

여기서 두 가지 갈림길을 보자.
- 토큰이 없거나 형식이 틀리면 → `res.status(401).json(...)`을 호출하고 `return`. **`next()`를 안 부르니까 요청은 여기서 끝**. 뒤에 있는 라우터 핸들러는 아예 실행되지 않는다.
- 토큰이 유효하면 → `req.user`에 토큰 안에 있던 정보(`{ id, role, storeId }`)를 채워넣고 `next()` 호출. **다음 함수(진짜 라우터 로직)로 요청이 넘어간다.** 이때 넘어간 라우터 핸들러는 `req.user`를 그대로 꺼내 쓸 수 있다 — 미들웨어가 req 객체에 값을 "가공해서 더해준" 것.

## 요청이 실제로 어떻게 흘러가는지 (단계별)

`GET /api/stores/me` 요청이 들어왔다고 하자. `stores.js` 라우터에서 이 경로가 `requireAuth` 뒤에 등록돼 있다면:

1. 요청이 서버에 도착.
2. `app.use(cors(...))` 통과 — 허용된 출처(origin)인지 확인. 문제없으면 다음으로.
3. `app.use(express.json())` 통과 — 요청 body가 있으면 JSON 문자열을 파싱해서 `req.body` 객체로 만들어둠.
4. 경로가 `/api/stores`로 시작하니까 `storesRouter` 안으로 들어감.
5. 라우터 안에서 `/me` 경로에 등록된 `requireAuth` 미들웨어 실행 — 토큰 검증, 통과하면 `req.user` 채우고 `next()`.
6. 마지막으로 실제 핸들러 함수 실행 — `req.user.storeId`로 DB 조회해서 응답.

이 중 하나라도 중간에 `next()`를 안 부르면 그 뒤 단계는 아예 실행되지 않고, 그 미들웨어가 보낸 응답이 클라이언트한테 그대로 간다.

## 왜 이 순서로 짰는지

`index.js`를 보면 `cors()` → `express.json()` → 라우터들 순서다. 이 순서가 중요한 이유:

- `cors()`가 라우터보다 먼저 있어야, 허용 안 된 출처의 요청은 라우터 로직(DB 조회 등)까지 가지도 못하고 미리 걸러진다. 불필요한 작업을 아예 안 하게 되는 셈.
- `express.json()`이 라우터보다 먼저 있어야 한다. 이게 뒤에 있으면 라우터 핸들러 안에서 `req.body.email` 같은 걸 읽으려 할 때 `req.body`가 아직 파싱되기 전이라 `undefined`가 나온다.
- `requireAuth`는 각 라우터 파일 안에서, 인증이 필요한 특정 경로 앞에만 붙인다 (전체 앱에 다 걸면 회원가입/로그인 같은 인증 필요 없는 경로까지 막혀버리니까).

## 헷갈리기 쉬운 부분

- **`next()`를 안 부르는데 응답도 안 보내면?** 요청이 그냥 멈춰버린다 (클라이언트는 응답을 영원히 기다림). 미들웨어는 반드시 "응답을 보내고 끝내거나" "next()를 불러서 넘기거나" 둘 중 하나를 해야 한다.
- **`app.use()`와 `app.get()`의 차이**: `app.use()`는 모든 HTTP 메서드(GET/POST/...)와 그 경로로 시작하는 모든 하위 경로에 다 적용된다. `app.get('/api/health', ...)`처럼 메서드+정확한 경로를 지정하면 그 조합에만 적용된다.
- **미들웨어는 라우터 안에도 있을 수 있다**: `index.js`에 있는 `app.use(cors())`처럼 앱 전체에 거는 것도 있고, `requireAuth`처럼 라우터 파일 안에서 특정 경로 앞에만 거는 것도 있다. 둘 다 "요청이 최종 처리 전에 거쳐 가는 함수"라는 점은 같다.

## 관련 개념

- [JWT 인증 미들웨어](./jwt-auth.md) — `requireAuth`가 실제로 토큰을 어떻게 검증하는지 (예정)
- [라우터 분리 패턴](./router-structure.md) — `app.use('/api/stores', storesRouter)`처럼 경로별로 라우터를 나누는 구조
