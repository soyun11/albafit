import { describe, it, expect, vi } from 'vitest'

vi.mock('./prisma.js', () => ({
  default: {
    storeRule: { findMany: vi.fn() },
  },
}))

import prisma from './prisma.js'
import {
  normalizeRulesText,
  computeTextSimilarity,
  findBestReuseCandidate,
  SIMILARITY_THRESHOLD,
  findReuseCandidateBatches,
} from './rubricReuse.js'

describe('normalizeRulesText', () => {
  it('문장부호를 없애고 공백 기준으로 토큰화한다', () => {
    const result = normalizeRulesText('포장 손님에겐 빨대를 요청 시에만 드려요.')
    expect(result).toEqual(['포장', '손님에겐', '빨대를', '요청', '시에만', '드려요'])
  })

  it('공백 개수나 줄바꿈이 달라도 같은 토큰 배열이 나온다', () => {
    const result = normalizeRulesText('포장   손님에겐\n빨대를 요청 시에만   드려요.')
    expect(result).toEqual(['포장', '손님에겐', '빨대를', '요청', '시에만', '드려요'])
  })

  it('빈 문자열이면 빈 배열을 반환한다', () => {
    expect(normalizeRulesText('')).toEqual([])
  })
})

describe('computeTextSimilarity', () => {
  it('완전히 같은 텍스트는 유사도 1이다', () => {
    const text = '포장 손님에겐 빨대를 요청 시에만 드려요.'
    expect(computeTextSimilarity(text, text)).toBe(1)
  })

  it('공백/줄바꿈 차이만 있으면 유사도 1이다', () => {
    const textA = '포장 손님에겐 빨대를 요청 시에만 드려요.'
    const textB = '포장   손님에겐\n빨대를 요청 시에만   드려요.'
    expect(computeTextSimilarity(textA, textB)).toBe(1)
  })

  it('겹치는 단어가 하나도 없으면 유사도 0이다', () => {
    const textA = '포장 손님에겐 빨대를 요청 시에만 드려요.'
    const textB = '환불은 영수증이 있어야만 가능합니다.'
    expect(computeTextSimilarity(textA, textB)).toBe(0)
  })

  it('일부만 겹치면 자카드 유사도(교집합 크기 / 합집합 크기)로 계산한다', () => {
    // A 토큰 8개, B 토큰 7개, 겹치는 토큰 6개(음료가·늦게·나오면·사과하고·시간을·안내한다) → 6 / (8+7-6) = 2/3
    const textA = '음료가 늦게 나오면 죄송하다고 사과하고 대기 시간을 안내한다.'
    const textB = '음료가 늦게 나오면 사과하고 예상 시간을 안내한다.'
    expect(computeTextSimilarity(textA, textB)).toBeCloseTo(2 / 3, 5)
  })

  it('둘 다 빈 문자열이면 유사도 0이다 (근거 없는 일치를 재사용으로 잘못 판단하지 않도록)', () => {
    expect(computeTextSimilarity('', '')).toBe(0)
  })

  it('한쪽만 빈 문자열이면 유사도 0이다', () => {
    expect(computeTextSimilarity('규칙 내용이 있다', '')).toBe(0)
  })
})

describe('findBestReuseCandidate', () => {
  const targetRawText = '포장 손님에겐 빨대를 요청 시에만 드려요.'

  // target 토큰 6개와 완전히 겹치지 않는 후보 → 유사도 0
  const candidateLow = { storeRuleId: 'sr-low', rawText: '환불은 영수증이 있어야만 가능합니다.' }
  // target 토큰 6개를 전부 포함 + 새 토큰 1개(별도결제) → 교집합 6 / 합집합 7 = 6/7 ≈ 0.857
  const candidateMid = { storeRuleId: 'sr-mid', rawText: '포장 손님에겐 빨대를 요청 시에만 드려요 별도결제.' }
  // target과 완전히 동일 → 유사도 1
  const candidateHigh = { storeRuleId: 'sr-high', rawText: targetRawText }

  it('후보가 없으면 null을 반환한다', () => {
    expect(findBestReuseCandidate([], targetRawText)).toBe(null)
  })

  it('전부 threshold 미만이면 null을 반환한다', () => {
    expect(findBestReuseCandidate([candidateLow], targetRawText)).toBe(null)
  })

  it('threshold 이상인 후보 중 가장 유사도가 높은 것을 고른다', () => {
    const result = findBestReuseCandidate([candidateLow, candidateMid, candidateHigh], targetRawText)
    expect(result.storeRuleId).toBe('sr-high')
  })

  it('기본 threshold(SIMILARITY_THRESHOLD)와 정확히 같은 점수도 포함한다(경계값)', () => {
    // candidateMid의 유사도(6/7)를 그대로 threshold로 지정 — 미만이 아니라 "이상"이면 포함돼야 함
    const result = findBestReuseCandidate([candidateMid], targetRawText, 6 / 7)
    expect(result.storeRuleId).toBe('sr-mid')
  })

  it('선택된 후보에 similarityScore가 함께 포함된다', () => {
    const result = findBestReuseCandidate([candidateHigh], targetRawText)
    expect(result.similarityScore).toBe(1)
  })

  it('SIMILARITY_THRESHOLD는 기본값으로 내보내져 있고 0~1 사이 값이다', () => {
    expect(SIMILARITY_THRESHOLD).toBeGreaterThan(0)
    expect(SIMILARITY_THRESHOLD).toBeLessThanOrEqual(1)
  })
})

describe('findReuseCandidateBatches', () => {
  const approvedScenario = (n) => ({
    type: `scenario-${n}`,
    title: `시나리오${n}`,
    persona: { situation: `상황${n}` },
    initialState: {},
    rubrics: [{ criteria: [{ item: `기준${n}` }], approvedAt: new Date('2026-07-01') }],
  })

  const unapprovedScenario = (n) => ({
    type: `scenario-${n}`,
    title: `시나리오${n}`,
    persona: {},
    initialState: {},
    rubrics: [{ criteria: [], approvedAt: null }],
  })

  it('배치 안 모든 시나리오가 승인된 루브릭을 가진 경우만 후보로 반환한다', async () => {
    prisma.storeRule.findMany.mockResolvedValue([
      { id: 'sr-all-approved', rawText: '전부 승인된 배치', scenarios: [approvedScenario(1), approvedScenario(2)] },
      { id: 'sr-partial-approved', rawText: '일부만 승인된 배치', scenarios: [approvedScenario(1), unapprovedScenario(2)] },
    ])

    const result = await findReuseCandidateBatches({ industry: 'cafe', excludeStoreId: 'store-self' })

    expect(result).toHaveLength(1)
    expect(result[0].storeRuleId).toBe('sr-all-approved')
  })

  it('시나리오가 하나도 없는 배치는 후보에서 제외한다', async () => {
    prisma.storeRule.findMany.mockResolvedValue([{ id: 'sr-empty', rawText: '시나리오 없음', scenarios: [] }])

    const result = await findReuseCandidateBatches({ industry: 'cafe', excludeStoreId: 'store-self' })

    expect(result).toEqual([])
  })

  it('반환된 후보에 복제에 필요한 시나리오·루브릭 데이터가 그대로 담긴다', async () => {
    prisma.storeRule.findMany.mockResolvedValue([
      { id: 'sr-all-approved', rawText: '전부 승인된 배치', scenarios: [approvedScenario(1)] },
    ])

    const result = await findReuseCandidateBatches({ industry: 'cafe', excludeStoreId: 'store-self' })

    expect(result[0].scenarios).toEqual([
      { type: 'scenario-1', title: '시나리오1', persona: { situation: '상황1' }, initialState: {}, criteria: [{ item: '기준1' }] },
    ])
  })

  it('같은 업종 + 자기 매장 제외 조건으로 조회한다', async () => {
    prisma.storeRule.findMany.mockResolvedValue([])

    await findReuseCandidateBatches({ industry: 'cafe', excludeStoreId: 'store-self' })

    expect(prisma.storeRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { store: { industry: 'cafe' }, storeId: { not: 'store-self' } },
      })
    )
  })
})
