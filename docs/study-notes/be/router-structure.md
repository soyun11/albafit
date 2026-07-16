# 라우터 분리 패턴

라우터는 미니 Express 앱이다. 파일마다 하나씩 만들고, `index.js`에서 경로 앞에 붙여서 합친다.

```js
// stores.js
const router = Router()
router.post('/', requireAuth, requireRole('owner'), async (req, res) => { ... })
export default router
```
```js
// index.js
app.use('/api/stores', storesRouter)
```

`router.post('/', ...)`의 `'/'`는 `index.js`에서 `/api/stores`에 붙였으니 실제로는 `POST /api/stores`가 된다.

`requireAuth, requireRole('owner')`는 핸들러 앞에 줄줄이 놓인 [미들웨어](./middleware.md)들이다. 요청이 들어오면 `requireAuth`(로그인했는지) → `requireRole('owner')`(사장님인지) → 마지막 함수(실제 로직) 순서로 통과한다. 하나라도 막히면 뒤는 실행 안 된다.

**왜 파일을 나누는지**: `index.js` 하나에 모든 API를 다 적으면 수백 줄이 되니까, `/api/auth`, `/api/stores`, `/api/sessions`처럼 기능 단위로 파일을 쪼개고 `index.js`는 "이 경로는 이 파일이 담당해"라고 연결만 해준다.

## 관련 개념
- [미들웨어](./middleware.md)
