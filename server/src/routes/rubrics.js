import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/requireAuth.js'

const router = Router()

// 본인 매장 소속 루브릭인지 scenario -> store 관계를 타고 올라가 확인한다.
// approve/edit 두 라우트가 똑같이 이 확인을 해야 해서 함수로 뺐다.
async function findOwnedRubric(id, storeId) {
  const rubric = await prisma.rubric.findUnique({ where: { id }, include: { scenario: true } })
  if (!rubric) {
    return { error: { status: 404, message: 'rubric not found' } }
  }
  if (rubric.scenario.storeId !== storeId) {
    return { error: { status: 403, message: 'rubric does not belong to your store' } }
  }
  return { rubric }
}

function isValidCriteria(criteria) {
  return (
    Array.isArray(criteria) &&
    criteria.length > 0 &&
    criteria.every(
      (c) =>
        c &&
        typeof c.item === 'string' &&
        typeof c.required === 'boolean' &&
        typeof c.good_example === 'string' &&
        typeof c.bad_example === 'string'
    )
  )
}

// ============================================================
// 루브릭 수정 — PATCH /api/rubrics/:id (사장님 전용)
// 사장님이 항목을 직접 고친 결과를 통째로 저장한다. 내용이 바뀌었으니 이전 승인은 무효로 되돌린다
// (승인해놓고 내용만 몰래 바뀐 루브릭이 세션에 쓰이면 안 되니까 — db-schema.md의 approved_at 설계 의도).
// ============================================================
router.patch('/:id', requireAuth, requireRole('owner'), async (req, res) => {
  const { criteria } = req.body ?? {}

  if (!isValidCriteria(criteria)) {
    return res.status(400).json({ error: 'criteria must be a non-empty array of {item, required, good_example, bad_example}' })
  }

  try {
    const { rubric, error } = await findOwnedRubric(req.params.id, req.user.storeId)
    if (error) {
      return res.status(error.status).json({ error: error.message })
    }

    const updated = await prisma.rubric.update({
      where: { id: rubric.id },
      data: { criteria, approvedAt: null },
    })
    return res.json(updated)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'failed to update rubric' })
  }
})

// ============================================================
// 루브릭 승인 — PATCH /api/rubrics/:id/approve (사장님 전용)
// ============================================================
router.patch('/:id/approve', requireAuth, requireRole('owner'), async (req, res) => {
  try {
    const { rubric, error } = await findOwnedRubric(req.params.id, req.user.storeId)
    if (error) {
      return res.status(error.status).json({ error: error.message })
    }

    const approved = await prisma.rubric.update({
      where: { id: rubric.id },
      data: { approvedAt: new Date() },
    })
    return res.json(approved)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'failed to approve rubric' })
  }
})

export default router
