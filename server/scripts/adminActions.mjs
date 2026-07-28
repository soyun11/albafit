// 관리자 CLI(admin.mjs)와 로컬 대시보드(admin-dashboard.mjs)가 공유하는 실제 동작.
// 둘 다 이 모듈만 호출하고, 화면 출력(console.log/HTML) 방식만 각자 다르게 한다.
import prisma from '../src/lib/prisma.js'
import { hashPassword } from '../src/lib/auth.js'
import { generateLinkKey } from '../src/lib/linkKey.js'
import { seedDefaultScenarios } from '../src/lib/defaultScenarios.js'

export async function listAccounts() {
  const stores = await prisma.store.findMany({ include: { users: true }, orderBy: { createdAt: 'desc' } })
  const orphanUsers = await prisma.user.findMany({ where: { storeId: null } })

  return {
    stores: stores.map((store) => ({
      id: store.id,
      industry: store.industry,
      name: store.name,
      owner: store.users.find((u) => u.role === 'owner') ?? null,
      staff: store.users.filter((u) => u.role === 'staff'),
    })),
    orphanUsers,
  }
}

export async function createTestStore({ ownerEmail, ownerPassword, industry, storeName, ownerName, staffEmail, staffPassword, staffName }) {
  if (!ownerEmail || !ownerPassword) {
    throw new Error('사장님 이메일·비밀번호는 필수예요')
  }

  const owner = await prisma.user.create({
    data: { email: ownerEmail, passwordHash: await hashPassword(ownerPassword), role: 'owner', name: ownerName || '테스트 사장님' },
  })
  const store = await prisma.store.create({
    data: { linkKey: generateLinkKey(), industry: industry || 'cafe', name: storeName || '테스트 매장' },
  })
  await prisma.user.update({ where: { id: owner.id }, data: { storeId: store.id } })
  await seedDefaultScenarios({ storeId: store.id, industry: store.industry })

  let staff = null
  if (staffEmail && staffPassword) {
    staff = await prisma.user.create({
      data: { email: staffEmail, passwordHash: await hashPassword(staffPassword), role: 'staff', name: staffName || '테스트 알바', storeId: store.id },
    })
  }

  return { owner, store, staff }
}

export async function resetPassword({ email, password }) {
  if (!email || !password) {
    throw new Error('이메일·비밀번호는 필수예요')
  }
  if (password.length < 8) {
    throw new Error('비밀번호는 8자 이상이어야 해요')
  }
  return prisma.user.update({ where: { email }, data: { passwordHash: await hashPassword(password) } })
}

// 삭제될 대상만 미리 보여준다 — 실제로 지우지 않는다. CLI의 --yes 없는 실행, 대시보드의
// 확인 화면 둘 다 이 함수로 "뭐가 지워질지"를 계산한다.
export async function previewDelete(email) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return null

  const staffInStore = user.role === 'owner' && user.storeId
    ? await prisma.user.findMany({ where: { storeId: user.storeId, role: 'staff' } })
    : []

  return { user, staffInStore }
}

export async function deleteAccount(email) {
  const preview = await previewDelete(email)
  if (!preview) return null
  const { user, staffInStore } = preview

  for (const staff of staffInStore) {
    await prisma.user.delete({ where: { id: staff.id } })
  }
  if (user.role === 'owner' && user.storeId) {
    // storeRules/scenarios/rubrics/trainingSessions/sessionTurns는 스키마의 onDelete: Cascade로
    // 자동 삭제된다(server/prisma/schema.prisma) — 여기서 따로 안 지운다.
    await prisma.store.delete({ where: { id: user.storeId } })
  }
  await prisma.user.delete({ where: { id: user.id } })

  return preview
}
