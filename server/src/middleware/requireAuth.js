import { verifyAccessToken } from '../lib/auth.js'

// Authorization: Bearer <token> 헤더를 검증해서 req.user에 { id, role, storeId }를 채운다.
// 토큰 안 값만 믿고 DB를 다시 조회하지 않는다(가입 시 토큰에 필요한 값을 이미 다 담아둠).
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

// requireAuth 뒤에 붙여서 특정 role만 통과시킨다. 예: requireRole('owner')
export function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ error: `${role} role required` })
    }
    return next()
  }
}
