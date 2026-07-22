import { describe, it, expect, vi } from 'vitest'

vi.mock('./prisma.js', () => ({
  default: {
    sessionTurn: { findUnique: vi.fn() },
  },
}))

import prisma from './prisma.js'
import { buildTurnCalibrationView, applyOwnerCorrection, findOwnedTurn, buildCorrectionHistory } from './evaluationCalibration.js'

describe('buildTurnCalibrationView', () => {
  it('턴 배열을 사장님 화면이 그리기 쉬운 형태로 변환한다', () => {
    const sessionTurns = [
      {
        id: 't1',
        turnNumber: 1,
        retryCount: 0,
        customerMessage: '얼마나 걸려요?',
        staffAnswer: '죄송합니다, 5분 정도 걸려요.',
        passed: true,
        evaluation: {
          metItems: [{ item: 'ETA 안내', met: true }],
          feedback: '잘하셨어요',
          improvedAnswer: '5분 정도 걸려요, 죄송합니다',
        },
      },
    ]

    const result = buildTurnCalibrationView(sessionTurns)

    expect(result).toEqual([
      {
        turnId: 't1',
        turnNumber: 1,
        retryCount: 0,
        customerMessage: '얼마나 걸려요?',
        staffAnswer: '죄송합니다, 5분 정도 걸려요.',
        passed: true,
        metItems: [{ item: 'ETA 안내', met: true }],
        feedback: '잘하셨어요',
        improvedAnswer: '5분 정도 걸려요, 죄송합니다',
        ownerCorrection: null,
      },
    ])
  })

  it('사장님이 이미 교정한 턴은 ownerCorrection을 그대로 담는다', () => {
    const correction = { correctedItems: [{ item: 'ETA 안내', met: false }], comment: '사실 시간 안내 안 했음', correctedAt: '2026-07-22T00:00:00.000Z' }
    const sessionTurns = [
      {
        id: 't2',
        turnNumber: 1,
        retryCount: 0,
        customerMessage: 'x',
        staffAnswer: 'y',
        passed: true,
        evaluation: { metItems: [{ item: 'ETA 안내', met: true }], feedback: 'f', improvedAnswer: 'i', ownerCorrection: correction },
      },
    ]

    const result = buildTurnCalibrationView(sessionTurns)

    expect(result[0].ownerCorrection).toEqual(correction)
  })

  it('빈 배열이면 빈 배열을 반환한다', () => {
    expect(buildTurnCalibrationView([])).toEqual([])
  })
})

describe('applyOwnerCorrection', () => {
  const evaluation = {
    metItems: [
      { item: 'ETA 안내', met: true },
      { item: '사과 표현', met: false },
    ],
    feedback: '원본 피드백',
    improvedAnswer: '원본 개선문장',
    passed: false,
  }

  it('correctedItems·comment를 ownerCorrection으로 병합하고 원본 필드는 그대로 둔다', () => {
    const result = applyOwnerCorrection(evaluation, {
      correctedItems: [{ item: 'ETA 안내', met: false }],
      comment: '사실 시간 안내 안 했음',
    })

    expect(result.metItems).toEqual(evaluation.metItems)
    expect(result.feedback).toBe('원본 피드백')
    expect(result.ownerCorrection.correctedItems).toEqual([{ item: 'ETA 안내', met: false }])
    expect(result.ownerCorrection.comment).toBe('사실 시간 안내 안 했음')
    expect(typeof result.ownerCorrection.correctedAt).toBe('string')
  })

  it('원본 evaluation 객체를 변형하지 않는다', () => {
    const before = JSON.parse(JSON.stringify(evaluation))
    applyOwnerCorrection(evaluation, { correctedItems: [{ item: 'ETA 안내', met: false }], comment: '' })
    expect(evaluation).toEqual(before)
  })

  it('원본 metItems에 없는 item 이름은 조용히 걸러낸다', () => {
    const result = applyOwnerCorrection(evaluation, {
      correctedItems: [
        { item: 'ETA 안내', met: false },
        { item: '존재하지 않는 기준', met: true },
      ],
      comment: '',
    })

    expect(result.ownerCorrection.correctedItems).toEqual([{ item: 'ETA 안내', met: false }])
  })

  it('met이 boolean이 아닌 항목은 걸러낸다', () => {
    const result = applyOwnerCorrection(evaluation, {
      correctedItems: [{ item: 'ETA 안내', met: 'yes' }],
      comment: '',
    })

    expect(result.ownerCorrection.correctedItems).toEqual([])
  })

  it('correctedItems가 없으면 빈 배열로, comment가 문자열이 아니면 빈 문자열로 대체한다', () => {
    const result = applyOwnerCorrection(evaluation, {})

    expect(result.ownerCorrection.correctedItems).toEqual([])
    expect(result.ownerCorrection.comment).toBe('')
  })
})

describe('findOwnedTurn', () => {
  it('본인 매장 소속 턴이면 turn을 반환한다', async () => {
    prisma.sessionTurn.findUnique.mockResolvedValue({
      id: 't1',
      evaluation: {},
      session: { storeId: 'store-a' },
    })

    const result = await findOwnedTurn('t1', 'store-a')

    expect(result.turn.id).toBe('t1')
    expect(result.error).toBeUndefined()
  })

  it('턴이 없으면 404 에러를 반환한다', async () => {
    prisma.sessionTurn.findUnique.mockResolvedValue(null)

    const result = await findOwnedTurn('missing', 'store-a')

    expect(result.error).toEqual({ status: 404, message: 'session turn not found' })
  })

  it('다른 매장 소속 턴이면 403 에러를 반환한다', async () => {
    prisma.sessionTurn.findUnique.mockResolvedValue({
      id: 't1',
      evaluation: {},
      session: { storeId: 'store-b' },
    })

    const result = await findOwnedTurn('t1', 'store-a')

    expect(result.error).toEqual({ status: 403, message: 'session turn does not belong to your store' })
  })
})

describe('buildCorrectionHistory', () => {
  function makeTurn({ id, turnNumber = 1, retryCount = 0, evaluation, staffName = '검증알바', staffLabel = null, scenarioTitle = '음료 지연' }) {
    return {
      id,
      turnNumber,
      retryCount,
      evaluation,
      session: {
        staff: staffName ? { name: staffName } : null,
        staffLabel,
        scenario: { title: scenarioTitle },
      },
    }
  }

  it('ownerCorrection이 없는 턴은 제외한다', () => {
    const turns = [makeTurn({ id: 't1', evaluation: { metItems: [{ item: 'a', met: true }] } })]

    expect(buildCorrectionHistory(turns)).toEqual([])
  })

  it('실제로 값이 뒤집힌 항목만 changedItems에 담는다', () => {
    const turns = [
      makeTurn({
        id: 't1',
        evaluation: {
          metItems: [
            { item: 'ETA 안내', met: true },
            { item: '사과 표현', met: false },
          ],
          ownerCorrection: {
            correctedItems: [
              { item: 'ETA 안내', met: false },
              { item: '사과 표현', met: false },
            ],
            comment: '시간 안내 안 함',
            correctedAt: '2026-07-22T01:00:00.000Z',
          },
        },
      }),
    ]

    const result = buildCorrectionHistory(turns)

    expect(result).toEqual([
      {
        turnId: 't1',
        turnNumber: 1,
        retryCount: 0,
        staffName: '검증알바',
        scenarioTitle: '음료 지연',
        changedItems: [{ item: 'ETA 안내', originalMet: true, correctedMet: false }],
        comment: '시간 안내 안 함',
        correctedAt: '2026-07-22T01:00:00.000Z',
      },
    ])
  })

  it('항목은 안 바꾸고 코멘트만 남긴 경우 changedItems는 빈 배열이다', () => {
    const turns = [
      makeTurn({
        id: 't1',
        evaluation: {
          metItems: [{ item: 'a', met: false }],
          ownerCorrection: {
            correctedItems: [{ item: 'a', met: false }],
            comment: 'AI 판정 맞음',
            correctedAt: '2026-07-22T01:00:00.000Z',
          },
        },
      }),
    ]

    const result = buildCorrectionHistory(turns)

    expect(result[0].changedItems).toEqual([])
    expect(result[0].comment).toBe('AI 판정 맞음')
  })

  it('staff 계정이 없는 레거시 세션은 staffLabel로 대체한다', () => {
    const turns = [
      makeTurn({
        id: 't1',
        staffName: null,
        staffLabel: '김알바',
        evaluation: { metItems: [{ item: 'a', met: true }], ownerCorrection: { correctedItems: [], comment: '', correctedAt: '2026-07-22T01:00:00.000Z' } },
      }),
    ]

    expect(buildCorrectionHistory(turns)[0].staffName).toBe('김알바')
  })

  it('최근 교정 순(correctedAt 내림차순)으로 정렬한다', () => {
    const older = makeTurn({
      id: 'old',
      evaluation: { metItems: [{ item: 'a', met: true }], ownerCorrection: { correctedItems: [], comment: '', correctedAt: '2026-07-20T00:00:00.000Z' } },
    })
    const newer = makeTurn({
      id: 'new',
      evaluation: { metItems: [{ item: 'a', met: true }], ownerCorrection: { correctedItems: [], comment: '', correctedAt: '2026-07-22T00:00:00.000Z' } },
    })

    const result = buildCorrectionHistory([older, newer])

    expect(result.map((r) => r.turnId)).toEqual(['new', 'old'])
  })

  it('빈 배열이면 빈 배열을 반환한다', () => {
    expect(buildCorrectionHistory([])).toEqual([])
  })
})
