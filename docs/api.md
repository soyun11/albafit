# api.md — 백엔드 API 명세

> 구현된 엔드포인트만 기재한다. 새 API가 추가되면 이 문서에 이어서 정리한다 (`docs/checklist.md` 진행 순서 참고).

## 매장 (Store)

로그인이 없는 서비스라 `linkKey`가 매장의 유일한 식별자이자 알바가 접속하는 URL slug다. 생성 로직: `server/src/lib/linkKey.js` (`crypto.randomBytes` 기반).

### `POST /api/stores`

매장 링크를 발급한다.

**요청 body** (전부 선택값)

| 필드 | 타입 | 설명 |
|---|---|---|
| `industry` | string, ≤50자 | 업종. 생략 시 기본값 `"cafe"` |
| `name` | string, ≤100자 | 매장명. 생략 시 `null` |

**성공 응답** `201`

```json
{
  "id": "efd20529-1fa8-4f40-b038-2b9a67e783e6",
  "linkKey": "C8oVYun9CXNmMrmT-FfB8A",
  "industry": "cafe",
  "name": "테스트카페",
  "createdAt": "2026-07-13T08:44:16.248Z"
}
```

**에러 응답**

| 상태 | 상황 | body |
|---|---|---|
| `400` | `industry`/`name` 타입 또는 길이 위반 | `{ "error": "industry must be a string of 50 characters or fewer" }` |
| `500` | `linkKey` 충돌 재시도(3회) 소진 또는 그 외 서버 오류 | `{ "error": "failed to create store" }` |

### `GET /api/stores/:linkKey`

매장 정보를 조회한다.

**성공 응답** `200` — `POST /api/stores` 성공 응답과 동일한 필드.

**에러 응답**

| 상태 | 상황 | body |
|---|---|---|
| `404` | 해당 `linkKey`의 매장 없음 | `{ "error": "store not found" }` |
| `500` | 서버 오류 | `{ "error": "failed to fetch store" }` |
