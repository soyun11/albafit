import { describe, it, expect, vi } from 'vitest'

vi.mock('./prisma.js', () => ({
  default: {
    scenario: { create: vi.fn() },
    rubric: { create: vi.fn() },
  },
}))

import prisma from './prisma.js'
import { buildDefaultSeedData, seedDefaultScenarios } from './defaultScenarios.js'

describe('buildDefaultSeedData', () => {
  it('카페 업종이면 기본 시나리오 배열을 반환한다', () => {
    const now = new Date('2026-07-27T00:00:00.000Z')
    const result = buildDefaultSeedData('cafe', now)

    expect(result.length).toBeGreaterThan(0)
  })

  it('반환된 각 시나리오의 storeRuleId는 null이다 (최신 배치 필터가 자동 통과되도록)', () => {
    const now = new Date('2026-07-27T00:00:00.000Z')
    const result = buildDefaultSeedData('cafe', now)

    for (const { scenario } of result) {
      expect(scenario.storeRuleId).toBeNull()
    }
  })

  it('반환된 각 루브릭의 approvedAt은 넘겨준 now 그대로다 (처음부터 승인된 상태로 시작)', () => {
    const now = new Date('2026-07-27T00:00:00.000Z')
    const result = buildDefaultSeedData('cafe', now)

    for (const { rubric } of result) {
      expect(rubric.approvedAt).toBe(now)
    }
  })

  it('type은 scenario-1, scenario-2... 순서로 매겨진다', () => {
    const result = buildDefaultSeedData('cafe', new Date())

    result.forEach(({ scenario }, i) => {
      expect(scenario.type).toBe(`scenario-${i + 1}`)
    })
  })

  it('시딩 데이터가 없는 업종은 빈 배열을 반환한다 (그 업종은 기존 콜드스타트 그대로 유지)', () => {
    const result = buildDefaultSeedData('없는업종', new Date())
    expect(result).toEqual([])
  })

  it('각 시나리오는 title·persona(situation, opening)를 가진다', () => {
    const result = buildDefaultSeedData('cafe', new Date())

    for (const { scenario } of result) {
      expect(typeof scenario.title).toBe('string')
      expect(scenario.title.length).toBeGreaterThan(0)
      expect(typeof scenario.persona.situation).toBe('string')
      expect(typeof scenario.persona.opening).toBe('string')
    }
  })

  it('각 루브릭의 criteria는 {item, required, good_example, bad_example} 형태의 배열이다', () => {
    const result = buildDefaultSeedData('cafe', new Date())

    for (const { rubric } of result) {
      expect(Array.isArray(rubric.criteria)).toBe(true)
      expect(rubric.criteria.length).toBeGreaterThan(0)
      for (const item of rubric.criteria) {
        expect(typeof item.item).toBe('string')
        expect(typeof item.required).toBe('boolean')
        expect(typeof item.good_example).toBe('string')
        expect(typeof item.bad_example).toBe('string')
      }
    }
  })

  it('IndustrySelect.jsx의 6개 업종 전부 시나리오 3개씩을 반환한다', () => {
    const industries = ['cafe', 'convenience', 'restaurant', 'mart', 'pcroom', 'beauty']
    for (const industry of industries) {
      expect(buildDefaultSeedData(industry)).toHaveLength(3)
    }
  })
})

describe('seedDefaultScenarios', () => {
  it('카페 업종이면 buildDefaultSeedData 개수만큼 scenario·rubric을 생성한다', async () => {
    prisma.scenario.create.mockReset().mockResolvedValue({ id: 'scenario-db-1' })
    prisma.rubric.create.mockReset().mockResolvedValue({ id: 'rubric-db-1' })

    await seedDefaultScenarios({ storeId: 'store-1', industry: 'cafe' })

    const expectedCount = buildDefaultSeedData('cafe').length
    expect(prisma.scenario.create).toHaveBeenCalledTimes(expectedCount)
    expect(prisma.rubric.create).toHaveBeenCalledTimes(expectedCount)
  })

  it('scenario.create에 storeId가 그대로 붙는다', async () => {
    prisma.scenario.create.mockReset().mockResolvedValue({ id: 'scenario-db-1' })
    prisma.rubric.create.mockReset().mockResolvedValue({ id: 'rubric-db-1' })

    await seedDefaultScenarios({ storeId: 'store-42', industry: 'cafe' })

    expect(prisma.scenario.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ storeId: 'store-42' }) })
    )
  })

  it('rubric.create에 방금 만든 scenario의 id가 scenarioId로 붙는다', async () => {
    prisma.scenario.create.mockReset().mockResolvedValue({ id: 'scenario-db-99' })
    prisma.rubric.create.mockReset().mockResolvedValue({ id: 'rubric-db-1' })

    await seedDefaultScenarios({ storeId: 'store-1', industry: 'cafe' })

    expect(prisma.rubric.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ scenarioId: 'scenario-db-99' }) })
    )
  })

  it('시딩 데이터가 없는 업종이면 아무것도 생성하지 않고 조용히 끝난다', async () => {
    prisma.scenario.create.mockReset()
    prisma.rubric.create.mockReset()

    await seedDefaultScenarios({ storeId: 'store-1', industry: '없는업종' })

    expect(prisma.scenario.create).not.toHaveBeenCalled()
    expect(prisma.rubric.create).not.toHaveBeenCalled()
  })

  it('DB 쓰기 도중 실패해도 절대 throw하지 않는다 (매장 생성 자체를 절대 깨뜨리면 안 됨)', async () => {
    prisma.scenario.create.mockReset().mockRejectedValue(new Error('db down'))
    prisma.rubric.create.mockReset()

    await expect(seedDefaultScenarios({ storeId: 'store-1', industry: 'cafe' })).resolves.not.toThrow()
  })

  it('DB 쓰기 도중 실패하면 실패 시점까지만 만들어지고 멈춘다(그 이후 시나리오는 시도하지 않음)', async () => {
    prisma.scenario.create
      .mockReset()
      .mockResolvedValueOnce({ id: 'scenario-db-1' })
      .mockRejectedValueOnce(new Error('db down'))
    prisma.rubric.create.mockReset().mockResolvedValue({ id: 'rubric-db-1' })

    await seedDefaultScenarios({ storeId: 'store-1', industry: 'cafe' })

    // 카페는 시나리오 3개 — 실패는 두 번째 create에서 나므로 세 번째는 시도조차 안 된다.
    expect(prisma.scenario.create).toHaveBeenCalledTimes(2)
  })
})
