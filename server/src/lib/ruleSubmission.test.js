import { describe, it, expect, vi } from 'vitest'
import { submitRuleBatch } from './ruleSubmission.js'

// prisma.$transaction이 넘겨주는 tx 클라이언트를 흉내낸 가짜 객체 — 실제 DB 없이도
// "storeRule 먼저 → 그 id로 scenario/rubric 연결"이 되는지 검증할 수 있다.
function buildFakeTx() {
  let scenarioCount = 0
  return {
    storeRule: { create: vi.fn().mockResolvedValue({ id: 'rule-1', rawText: 'raw' }) },
    scenario: {
      create: vi.fn().mockImplementation(() => {
        scenarioCount += 1
        return Promise.resolve({ id: `scenario-db-${scenarioCount}` })
      }),
    },
    rubric: {
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: `rubric-${data.scenarioId}`, ...data })),
    },
  }
}

function makeBatchItem(i, overrides = {}) {
  return {
    scenario: { type: `scenario-${i}`, title: `테스트 ${i}`, persona: { situation: 'sit', opening: 'open' }, initialState: {} },
    rubric: { criteria: [{ item: 'a', required: true, good_example: 'g', bad_example: 'b' }], version: 1, approvedAt: null },
    ...overrides,
  }
}

describe('submitRuleBatch', () => {
  it('storeRule을 먼저 만들고, 그 id를 scenario.storeRuleId로 연결한다', async () => {
    const tx = buildFakeTx()

    await submitRuleBatch(tx, { storeId: 'store-1', rawText: 'raw', batch: [makeBatchItem(1)] })

    expect(tx.scenario.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ storeId: 'store-1', storeRuleId: 'rule-1' }) })
    )
  })

  it('scenario에서 만들어진 id를 rubric.scenarioId로 연결한다', async () => {
    const tx = buildFakeTx()

    await submitRuleBatch(tx, { storeId: 'store-1', rawText: 'raw', batch: [makeBatchItem(1)] })

    expect(tx.rubric.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ scenarioId: 'scenario-db-1' }) })
    )
  })

  it('batch 개수만큼 시나리오+루브릭이 만들어진다', async () => {
    const tx = buildFakeTx()
    const batch = [1, 2, 3].map((i) => makeBatchItem(i))

    await submitRuleBatch(tx, { storeId: 'store-1', rawText: 'raw', batch })

    expect(tx.scenario.create).toHaveBeenCalledTimes(3)
    expect(tx.rubric.create).toHaveBeenCalledTimes(3)
  })

  it('중간 create 하나가 실패하면 함수 전체가 reject된다 (트랜잭션 롤백을 보장하는 핵심 지점)', async () => {
    const tx = buildFakeTx()
    tx.rubric.create = vi
      .fn()
      .mockResolvedValueOnce({ id: 'rubric-1' })
      .mockRejectedValueOnce(new Error('db down'))

    const batch = [1, 2].map((i) => makeBatchItem(i))

    await expect(submitRuleBatch(tx, { storeId: 'store-1', rawText: 'raw', batch })).rejects.toThrow('db down')
  })

  it('반환값의 storeRule과, 시나리오 메타(제목·상황·오프닝)가 붙은 rubrics 배열을 돌려준다', async () => {
    const tx = buildFakeTx()
    const batch = [makeBatchItem(1, { scenario: { type: 'scenario-1', title: '음료 지연', persona: { situation: 'sit', opening: 'open' }, initialState: {} } })]

    const result = await submitRuleBatch(tx, { storeId: 'store-1', rawText: 'raw', batch })

    expect(result.storeRule.id).toBe('rule-1')
    expect(result.rubrics).toHaveLength(1)
    expect(result.rubrics[0].scenarioTitle).toBe('음료 지연')
    expect(result.rubrics[0].situation).toBe('sit')
    expect(result.rubrics[0].opening).toBe('open')
  })

  it('category·items가 선택적으로 주어지면 storeRule 생성 데이터에 포함된다', async () => {
    const tx = buildFakeTx()

    await submitRuleBatch(tx, { storeId: 'store-1', rawText: 'raw', category: 'cafe', items: [{ title: 'a' }], batch: [] })

    expect(tx.storeRule.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ storeId: 'store-1', category: 'cafe', items: [{ title: 'a' }], rawText: 'raw' }) })
    )
  })
})
