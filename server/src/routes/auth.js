import { Router } from 'express'
import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma.js'
import {
  emailTokenExpiryDate,
  generateOpaqueToken,
  hashOpaqueToken,
  hashPassword,
  refreshTokenExpiryDate,
  signAccessToken,
  verifyPassword,
} from '../lib/auth.js'
import { sendVerificationEmail } from '../lib/email.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

// 로그인 응답에서 이 매장 링크가 있어야 사장님이 로그인만으로 자기 매장을 다시 찾을 수 있다.
function toPublicUser(user, store) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    storeId: user.storeId,
    emailVerifiedAt: user.emailVerifiedAt,
    store: store ? { id: store.id, linkKey: store.linkKey, name: store.name, industry: store.industry } : null,
  }
}

// 리프레시 토큰을 새로 만들어 DB에 해시로 저장하고, 원문(클라이언트에 내려줄 값)을 반환한다.
async function issueRefreshToken(userId) {
  const rawToken = generateOpaqueToken()
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashOpaqueToken(rawToken), expiresAt: refreshTokenExpiryDate() },
  })
  return rawToken
}

// 인증 메일 발송 실패는 회원가입 자체를 막지 않는다(이메일 서비스 장애로 가입이 통째로 막히면 안 되므로) —
// 실패하면 로그만 남기고, 사용자는 나중에 재발송을 요청할 수 있다.
async function sendSignupVerificationEmail(user) {
  try {
    const rawToken = generateOpaqueToken()
    await prisma.emailVerificationToken.create({
      data: { userId: user.id, tokenHash: hashOpaqueToken(rawToken), expiresAt: emailTokenExpiryDate() },
    })
    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${rawToken}`
    await sendVerificationEmail({ to: user.email, verifyUrl })
  } catch (err) {
    console.error('failed to send verification email', err)
  }
}

// ============================================================
// 사장님 회원가입 — POST /api/auth/signup
// 알바 계정은 셀프 가입이 없다(사장님이 대시보드에서 만들어줌). role은 항상 owner로 고정.
// ============================================================
router.post('/signup', async (req, res) => {
  const { email, password, name } = req.body ?? {}

  if (typeof email !== 'string' || email.trim().length === 0 || email.length > 255) {
    return res.status(400).json({ error: 'email is required' })
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' })
  }
  if (name !== undefined && (typeof name !== 'string' || name.length > 50)) {
    return res.status(400).json({ error: 'name must be a string of 50 characters or fewer' })
  }

  try {
    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        email: email.trim(),
        passwordHash,
        role: 'owner',
        ...(name !== undefined && { name }),
      },
    })

    await sendSignupVerificationEmail(user)

    const accessToken = signAccessToken(user)
    const refreshToken = await issueRefreshToken(user.id)
    return res.status(201).json({ accessToken, refreshToken, user: toPublicUser(user, null) })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ error: 'email already in use' })
    }
    console.error(err)
    return res.status(500).json({ error: 'failed to sign up' })
  }
})

// ============================================================
// 로그인 (사장님/알바 공용) — POST /api/auth/login
// ============================================================
router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {}

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'email and password are required' })
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: email.trim() } })
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ error: 'invalid email or password' })
    }

    const store = user.storeId ? await prisma.store.findUnique({ where: { id: user.storeId } }) : null
    const accessToken = signAccessToken(user)
    const refreshToken = await issueRefreshToken(user.id)
    return res.json({ accessToken, refreshToken, user: toPublicUser(user, store) })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'failed to log in' })
  }
})

// ============================================================
// 액세스 토큰 재발급 — POST /api/auth/refresh
// 로테이션: 쓸 때마다 기존 리프레시 토큰은 즉시 무효화하고 새 걸로 교체한다.
// 이미 무효화된(=한 번 쓴) 토큰이 다시 들어오면 도난으로 간주해 그 유저의 모든 리프레시 토큰을 막는다.
// ============================================================
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body ?? {}

  if (typeof refreshToken !== 'string' || !refreshToken) {
    return res.status(400).json({ error: 'refreshToken is required' })
  }

  try {
    const tokenHash = hashOpaqueToken(refreshToken)
    const record = await prisma.refreshToken.findUnique({ where: { tokenHash } })

    if (!record || record.expiresAt < new Date()) {
      return res.status(401).json({ error: 'invalid or expired refresh token' })
    }

    if (record.revokedAt) {
      // 이미 로테이션(또는 로그아웃)으로 무효화된 토큰이 재사용됐다 — 도난 의심, 전체 세션 차단.
      await prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      return res.status(401).json({ error: 'refresh token reuse detected, all sessions revoked' })
    }

    const user = await prisma.user.findUnique({ where: { id: record.userId } })
    if (!user) {
      return res.status(401).json({ error: 'invalid or expired refresh token' })
    }

    await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } })

    const accessToken = signAccessToken(user)
    const newRefreshToken = await issueRefreshToken(user.id)
    return res.json({ accessToken, refreshToken: newRefreshToken })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'failed to refresh token' })
  }
})

// ============================================================
// 로그아웃 — POST /api/auth/logout
// 프론트가 토큰을 지우는 것과 별개로, 서버에도 이 리프레시 토큰을 무효화해서 재사용을 막는다.
// ============================================================
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body ?? {}

  if (typeof refreshToken !== 'string' || !refreshToken) {
    return res.status(400).json({ error: 'refreshToken is required' })
  }

  try {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashOpaqueToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'failed to log out' })
  }
})

// ============================================================
// 이메일 인증 확인 — GET /api/auth/verify-email?token=...
// ============================================================
router.get('/verify-email', async (req, res) => {
  const { token } = req.query

  if (typeof token !== 'string' || !token) {
    return res.status(400).json({ error: 'token is required' })
  }

  try {
    const record = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashOpaqueToken(token) },
    })

    if (!record || record.expiresAt < new Date()) {
      return res.status(400).json({ error: 'invalid or expired token' })
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
      prisma.emailVerificationToken.delete({ where: { id: record.id } }),
    ])
    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'failed to verify email' })
  }
})

// ============================================================
// 인증 메일 재발송 — POST /api/auth/resend-verification (로그인 상태)
// ============================================================
router.post('/resend-verification', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!user) {
      return res.status(404).json({ error: 'user not found' })
    }
    if (user.emailVerifiedAt) {
      return res.status(400).json({ error: 'email already verified' })
    }

    // 예전에 보낸(아직 안 쓴) 토큰들은 재발송 시 전부 무효화 — 메일함에 여러 개 쌓여도 최신 것만 유효하게.
    await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } })
    await sendSignupVerificationEmail(user)
    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'failed to resend verification email' })
  }
})

// ============================================================
// 내 정보 조회 — GET /api/auth/me
// 토큰 안 storeId는 store 생성 시점 이후로 오래될 수 있어서, 여기선 DB에서 최신 값을 다시 읽는다.
// ============================================================
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!user) {
      return res.status(404).json({ error: 'user not found' })
    }
    const store = user.storeId ? await prisma.store.findUnique({ where: { id: user.storeId } }) : null
    return res.json({ user: toPublicUser(user, store) })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'failed to fetch current user' })
  }
})

// ============================================================
// 비밀번호 변경 — PATCH /api/auth/password
// 알바가 사장님이 정해준 초기 비밀번호를 자기 걸로 바꿀 때 씀. 현재 비밀번호 확인 필수.
// 비밀번호가 바뀌었다는 건 "예전 비밀번호가 새어나갔을 수도 있다"는 뜻이라, 다른 기기의 로그인 유지도
// 같이 끊어서 예전 비밀번호를 알고 있는 사람이 리프레시로 계속 들어오지 못하게 한다.
// ============================================================
router.patch('/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {}

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' })
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'newPassword must be at least 8 characters' })
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      return res.status(401).json({ error: 'current password is incorrect' })
    }

    const passwordHash = await hashPassword(newPassword)
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ])
    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'failed to change password' })
  }
})

export default router
export { toPublicUser }
