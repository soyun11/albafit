import { describe, it, expect, vi } from 'vitest'

vi.mock('./openai.js', () => ({
  default: {
    chat: { completions: { create: vi.fn() } },
  },
}))

import openai from './openai.js'
import {
  compareMetItems,
  findMismatches,
  crossCheckEvaluateTurn,
  logCrossCheckResult,
  runCrossCheck,
} from './evaluatorCrossCheck.js'

const CRITERIA = [
  { item: 'ETA 안내', required: true, good_example: '5분 정도 걸려요', bad_example: '몰라요' },
  { item: '사과 표현', required: true, good_example: '죄송합니다', bad_example: '...' },
  { item: '대안 제시', required: false, good_example: '다른 메뉴는 어떠세요', bad_example: '없어요' },
]

describe('compareMetItems', () => {
  it('두 모델의 met 값이 전부 같으면 mismatch가 하나도 없다', () => {
    const metItemsA = [
      { item: 'ETA 안내', met: true },
      { item: '사과 표현', met: true },
      { item: '대안 제시', met: false },
    ]
    const metItemsB = [
      { item: 'ETA 안내', met: true },
      { item: '사과 표현', met: true },
      { item: '대안 제시', met: false },
    ]

    const result = compareMetItems(CRITERIA, metItemsA, metItemsB)

    expect(result).toEqual([
      { item: 'ETA 안내', metA: true, metB: true, mismatch: false },
      { item: '사과 표현', metA: true, metB: true, mismatch: false },
      { item: '대안 제시', metA: false, metB: false, mismatch: false },
    ])
  })

  it('met 값이 다른 항목만 mismatch: true로 표시한다', () => {
    const metItemsA = [
      { item: 'ETA 안내', met: true },
      { item: '사과 표현', met: false },
      { item: '대안 제시', met: false },
    ]
    const metItemsB = [
      { item: 'ETA 안내', met: false },
      { item: '사과 표현', met: false },
      { item: '대안 제시', met: false },
    ]

    const result = compareMetItems(CRITERIA, metItemsA, metItemsB)

    expect(result).toEqual([
      { item: 'ETA 안내', metA: true, metB: false, mismatch: true },
      { item: '사과 표현', metA: false, metB: false, mismatch: false },
      { item: '대안 제시', metA: false, metB: false, mismatch: false },
    ])
  })

  it('전부 다르면 전부 mismatch: true다', () => {
    const metItemsA = [
      { item: 'ETA 안내', met: true },
      { item: '사과 표현', met: true },
      { item: '대안 제시', met: true },
    ]
    const metItemsB = [
      { item: 'ETA 안내', met: false },
      { item: '사과 표현', met: false },
      { item: '대안 제시', met: false },
    ]

    const result = compareMetItems(CRITERIA, metItemsA, metItemsB)

    expect(result.every((r) => r.mismatch)).toBe(true)
  })

  it('criteria가 빈 배열이면 빈 배열을 반환한다', () => {
    expect(compareMetItems([], [{ item: 'x', met: true }], [{ item: 'x', met: true }])).toEqual([])
  })

  it('한쪽 모델의 met_items에 해당 item이 없으면 met: false로 취급한다 (evaluator.js의 missingCriteria 계산과 동일한 원칙)', () => {
    const metItemsA = [{ item: 'ETA 안내', met: true }]
    const metItemsB = []

    const result = compareMetItems(CRITERIA, metItemsA, metItemsB)

    expect(result).toEqual([
      { item: 'ETA 안내', metA: true, metB: false, mismatch: true },
      { item: '사과 표현', metA: false, metB: false, mismatch: false },
      { item: '대안 제시', metA: false, metB: false, mismatch: false },
    ])
  })

  it('"[필수]/[선택] " 접두어가 붙어 와도 정규화해서 비교한다 (evaluator.js가 겪은 것과 같은 LLM echo 버그 방어)', () => {
    const metItemsA = [{ item: '[필수] ETA 안내', met: true }]
    const metItemsB = [{ item: 'ETA 안내', met: true }]

    const result = compareMetItems([CRITERIA[0]], metItemsA, metItemsB)

    expect(result).toEqual([{ item: 'ETA 안내', metA: true, metB: true, mismatch: false }])
  })
})

describe('findMismatches', () => {
  it('mismatch: true인 행만 걸러낸다', () => {
    const comparison = [
      { item: 'a', metA: true, metB: true, mismatch: false },
      { item: 'b', metA: true, metB: false, mismatch: true },
    ]

    expect(findMismatches(comparison)).toEqual([{ item: 'b', metA: true, metB: false, mismatch: true }])
  })

  it('불일치가 없으면 빈 배열을 반환한다', () => {
    const comparison = [{ item: 'a', metA: true, metB: true, mismatch: false }]
    expect(findMismatches(comparison)).toEqual([])
  })
})

describe('crossCheckEvaluateTurn', () => {
  it('OpenAI 응답에서 met_items 배열을 그대로 뽑아 반환한다', async () => {
    openai.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ met_items: [{ item: 'ETA 안내', met: true }] }) } }],
    })

    const result = await crossCheckEvaluateTurn({
      criteria: CRITERIA,
      customerMessage: '얼마나 걸려요?',
      staffAnswer: '5분 정도 걸려요.',
    })

    expect(result).toEqual([{ item: 'ETA 안내', met: true }])
    expect(openai.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o-mini' })
    )
  })
})

describe('logCrossCheckResult', () => {
  it('불일치가 없으면 console.log로 남긴다', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    logCrossCheckResult({ turnId: 't1', comparison: [{ item: 'a', metA: true, metB: true, mismatch: false }], mismatches: [] })

    expect(logSpy).toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()

    logSpy.mockRestore()
    warnSpy.mockRestore()
  })

  it('불일치가 있으면 console.warn으로 남긴다', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const mismatches = [{ item: 'a', metA: true, metB: false, mismatch: true }]

    logCrossCheckResult({ turnId: 't1', comparison: mismatches, mismatches })

    expect(warnSpy).toHaveBeenCalled()
    expect(logSpy).not.toHaveBeenCalled()

    logSpy.mockRestore()
    warnSpy.mockRestore()
  })
})

describe('runCrossCheck', () => {
  it('OpenAI 호출 결과와 Gemini 결과를 비교해서 로그를 남기고, 반환값 없이 끝난다', async () => {
    openai.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ met_items: [{ item: 'ETA 안내', met: false }] }) } }],
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await runCrossCheck({
      turnId: 't1',
      criteria: [CRITERIA[0]],
      customerMessage: '얼마나 걸려요?',
      staffAnswer: '5분 정도 걸려요.',
      geminiMetItems: [{ item: 'ETA 안내', met: true }],
    })

    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
