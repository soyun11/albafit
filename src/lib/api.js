const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

const ACCESS_TOKEN_KEY = 'albafit_access_token'
const REFRESH_TOKEN_KEY = 'albafit_refresh_token'

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setTokens({ accessToken, refreshToken }) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

// storeId가 갱신된 것처럼 refreshToken은 그대로 두고 accessToken만 새로 받은 경우(POST /api/stores)에 쓴다.
export function setAccessToken(accessToken) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

// 리프레시로도 로그인 복구가 안 될 때(리프레시 토큰 자체가 없거나 무효화됨) App.jsx가 로그인 화면으로
// 보내도록 등록해두는 콜백. api.js는 React state를 모르니 이런 식으로 알림만 보낸다.
let authExpiredHandler = null
export function setAuthExpiredHandler(handler) {
  authExpiredHandler = handler
}

// 서버 에러 문자열(영어, 로그/디버깅용 API 컨벤션)을 화면에 보여줄 한국어 문구로 바꾼다.
// 매핑에 없는 에러는 화면에 원문을 그대로 노출하지 않고 일반 문구로 감춘다.
const ERROR_MESSAGES_KO = {
  'email is required': '이메일을 입력해주세요.',
  'password must be at least 8 characters': '비밀번호는 8자 이상이어야 해요.',
  'name must be a string of 50 characters or fewer': '이름은 50자 이하로 입력해주세요.',
  'email already in use': '이미 가입된 이메일이에요.',
  'email and password are required': '이메일과 비밀번호를 입력해주세요.',
  'invalid email or password': '이메일 또는 비밀번호가 올바르지 않아요.',
  'currentPassword and newPassword are required': '현재 비밀번호와 새 비밀번호를 입력해주세요.',
  'newPassword must be at least 8 characters': '새 비밀번호는 8자 이상이어야 해요.',
  'current password is incorrect': '현재 비밀번호가 올바르지 않아요.',
  'create a store before adding staff': '먼저 매장을 만들어주세요.',
  'authorization token required': '로그인이 필요해요.',
  'invalid or expired token': '로그인이 만료됐어요. 다시 로그인해주세요.',
  'invalid or expired refresh token': '로그인이 만료됐어요. 다시 로그인해주세요.',
  'refresh token reuse detected, all sessions revoked': '보안을 위해 모든 기기에서 로그아웃됐어요. 다시 로그인해주세요.',
  'invalid or expired token (email verification)': '인증 링크가 만료됐거나 이미 사용됐어요.',
  'email already verified': '이미 인증된 이메일이에요.',
  'failed to sign up': '회원가입에 실패했어요. 잠시 후 다시 시도해주세요.',
  'failed to log in': '로그인에 실패했어요. 잠시 후 다시 시도해주세요.',
  'user not found': '계정을 찾을 수 없어요.',
  'failed to fetch current user': '내 정보를 불러오지 못했어요.',
  'failed to change password': '비밀번호 변경에 실패했어요.',
  'failed to create staff account': '알바 계정을 만들지 못했어요.',
}

// 액세스 토큰이 만료돼 401을 받으면, 리프레시 토큰으로 새 액세스 토큰을 한 번 받아와서 원래 요청을
// 다시 시도한다. 여러 요청이 동시에 401을 맞아도 재발급은 한 번만 일어나게 진행 중인 시도를 공유한다.
let refreshInFlight = null

async function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = getRefreshToken()
      if (!refreshToken) throw new Error('no refresh token')

      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'refresh failed')

      setTokens(data)
      return data.accessToken
    })().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

// 모든 API 호출이 거치는 얇은 fetch 래퍼.
// - Authorization 헤더를 매번 손으로 안 붙이게 토큰이 있으면 자동으로 붙인다.
// - 액세스 토큰이 만료돼 401이 오면 조용히 재발급받고 딱 한 번만 재시도한다(무한루프 방지).
// - 실패 응답(4xx/5xx)은 fetch가 알아서 에러를 던져주지 않으므로, 여기서 직접 확인해 throw한다.
export async function apiFetch(path, { method = 'GET', body, auth = true, _retried = false } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getAccessToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (response.status === 401 && auth && !_retried && getRefreshToken()) {
    try {
      await refreshAccessToken()
      return apiFetch(path, { method, body, auth, _retried: true })
    } catch {
      clearTokens()
      authExpiredHandler?.()
      throw new Error('로그인이 만료됐어요. 다시 로그인해주세요.')
    }
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(ERROR_MESSAGES_KO[data?.error] || `요청에 실패했어요 (${response.status})`)
  }

  return data
}
