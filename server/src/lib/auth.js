import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { randomBytes, createHash } from 'crypto'

const SALT_ROUNDS = 10
const ACCESS_TOKEN_EXPIRES_IN = '1h'
const REFRESH_TOKEN_EXPIRES_IN_MS = 30 * 24 * 60 * 60 * 1000 // 30일
const EMAIL_TOKEN_EXPIRES_IN_MS = 30 * 60 * 1000 // 30분

export function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash)
}

// 액세스 토큰 — 매 요청마다 보내는 짧은 수명(1시간) 토큰. 안에 최소 식별 정보만 담아 DB 조회 없이 검증한다.
export function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, storeId: user.storeId },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  )
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET)
}

// 리프레시 토큰/이메일 인증 토큰 — 무작위 문자열(JWT 아님). DB엔 해시만 저장하고 원문은 응답으로 한 번만 내려준다.
// 비밀번호와 달리 이미 충분히 무작위(32바이트)라 bcrypt처럼 일부러 느리게 만든 해시가 필요 없다 — 빠른
// SHA-256으로 해시해두면 "이 해시값과 일치하는 토큰이 있는지"를 DB 인덱스로 바로 조회할 수 있다
// (bcrypt는 매번 다른 salt가 섞여서 이런 정확 일치 조회가 불가능하다).
export function generateOpaqueToken() {
  return randomBytes(32).toString('hex')
}

export function hashOpaqueToken(rawToken) {
  return createHash('sha256').update(rawToken).digest('hex')
}

export function refreshTokenExpiryDate() {
  return new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS)
}

export function emailTokenExpiryDate() {
  return new Date(Date.now() + EMAIL_TOKEN_EXPIRES_IN_MS)
}
