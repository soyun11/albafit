import { Router } from 'express'
import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma.js'
import { generateLinkKey } from '../lib/linkKey.js'

const router = Router()

const MAX_LINK_KEY_RETRIES = 3

router.post('/', async (req, res) => {
  const { industry, name } = req.body ?? {}

  if (industry !== undefined && (typeof industry !== 'string' || industry.length > 50)) {
    return res.status(400).json({ error: 'industry must be a string of 50 characters or fewer' })
  }
  if (name !== undefined && (typeof name !== 'string' || name.length > 100)) {
    return res.status(400).json({ error: 'name must be a string of 100 characters or fewer' })
  }

  for (let attempt = 0; attempt < MAX_LINK_KEY_RETRIES; attempt++) {
    try {
      const store = await prisma.store.create({
        data: {
          linkKey: generateLinkKey(),
          ...(industry !== undefined && { industry }),
          ...(name !== undefined && { name }),
        },
      })
      return res.status(201).json(store)
    } catch (err) {
      const isLinkKeyConflict =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        err.meta?.target?.includes('link_key')
      if (!isLinkKeyConflict) {
        console.error(err)
        return res.status(500).json({ error: 'failed to create store' })
      }
    }
  }

  return res.status(500).json({ error: 'failed to create store' })
})

router.get('/:linkKey', async (req, res) => {
  try {
    const store = await prisma.store.findUnique({ where: { linkKey: req.params.linkKey } })
    if (!store) {
      return res.status(404).json({ error: 'store not found' })
    }
    return res.json(store)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'failed to fetch store' })
  }
})

export default router
