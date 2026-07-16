# JWT 인증

JWT는 서버가 서명해서 내주는 "신분증" 같은 토큰이다. 매 요청마다 DB를 안 뒤져도 검증할 수 있다는 게 핵심 장점.

```js
// server/src/lib/auth.js
export function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, storeId: user.storeId },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  )
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET)
}
```

로그인 성공하면 `signAccessToken`으로 `{id, role, storeId}`를 토큰 안에 넣고 서버 비밀키(`JWT_SECRET`)로 서명해서 클라이언트에 준다. 클라이언트는 이후 요청마다 이 토큰을 `Authorization: Bearer <토큰>` 헤더에 실어 보낸다.

[`requireAuth`](./middleware.md)가 하는 일이 바로 `verifyAccessToken(token)` 호출이다 — 서명이 위조 안 됐는지, 유효기간(1시간)이 안 지났는지만 확인하면 끝. 토큰 안에 `id`, `role`, `storeId`가 이미 들어있어서 DB를 다시 조회할 필요가 없다.

## 관련 개념
- [미들웨어](./middleware.md) — `requireAuth`가 이 검증을 어디서 실행하는지
