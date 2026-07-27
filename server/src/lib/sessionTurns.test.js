import { describe, it, expect } from 'vitest'
import { pickFinalAttempts, buildConversationHistory, computeHearts, buildSessionReportPayload, buildSessionSummary, decideTurnOutcome } from './sessionTurns.js'

// describe는 테스트를 묶는 단위. 보통 함수 하나당 하나씩.
describe('pickFinalAttempts', ()=>{
    // it은 테스트 케이스 하나를 의미. 첫번째 인자는 테스트 이름, 두번째 인자는 테스트 함수.
    it('재입력이 있어도 retryCount가 가장 큰 것만 남긴다', ()=>{
        
        //테스트용 데이터 만들기
        // 같은 턴에 재입력이 있는 상황을 가정.
        // 첫 시도는 실패, 재입력한 시도가 최종 답인 케이스(retryCount 1)


        const sessionTurns = [
            { turnNumber: 1, retryCount: 0},
            { turnNumber: 1, retryCount: 1},
        ]

        // 함수 실행
        const result = pickFinalAttempts(sessionTurns)

        // 결과 검증
        // expect(실제값).toBe(기대값)

        // DB 조회 순서가 아니라 retryCount 값으로 최종 답을 가리므로, 더 큰 값(1)이 살아남아야 함.

        // 같은 턴의 시도 2개가 하나로 합쳐졌는지 (중복 제거가 되는지)
        expect(result.length).toBe(1)

        // 합쳐질 때 더 작은 값(0,실패작) 이 아니라 더 큰 값(1, 최종 답)이 살아남는지
        expect(result[0].retryCount).toBe(1)
    })})

// 재입력한 시도를 버리지 않고 전부 대화 기록에 남긴다. 
describe('buildConversationHistory', ()=>{
    it('재입력한 시도를 버리지 않고 전부 대화 기록에 남긴다', ()=>{
        const sessionTurns = [
            { turnNumber: 1, retryCount: 0, customerMessage: '...', staffAnswer: '죄송합니다' },
            { turnNumber: 1, retryCount: 1, customerMessage: '...', staffAnswer: '10분 정도 걸려요' },
        ]

        const result = buildConversationHistory(sessionTurns)

        // 재입력한 시도가 버려지지 않고 모두 남아야 함.
        expect(result.length).toBe(3)
        expect(result[0].sender).toBe('customer')
        expect(result[1].sender).toBe('staff')
        expect(result[2].sender).toBe('staff')
        expect(result[1].text).toBe('죄송합니다')
        expect(result[2].text).toBe('10분 정도 걸려요')
    })
})

describe('computeHearts', ()=>{
    it('엉뚱한 답으로 깎인 하트를 최종 기준 개수 기반으로 계산한다', ()=>{
        const sessionTurns = [
            {turnNumber: 1, retryCount: 0, evaluation: { metItems: [] } },
            {turnNumber: 1, retryCount: 1, evaluation: { metItems: [{item:'a' , met: true}, {item:'b' , met: true}] } },
        ]

        const result = computeHearts(sessionTurns)

        expect(result.maxHearts).toBe(4)
        expect(result.heartsRemaining).toBe(3)

    })
})

describe('buildSessionReportPayload', () => {
  it('리포트 화면이 그리는 데이터(체크리스트·점수·소요시간)를 만든다', () => {
    const session = {
      id: 's1',
      startedAt: new Date('2026-07-22T00:00:00.000Z'),
      completedAt: new Date('2026-07-22T00:05:00.000Z'),
      scenario: { title: '품절 메뉴 대처' },
      sessionTurns: [
        { turnNumber: 1, retryCount: 0, evaluation: { metItems: [{ item: 'ETA 안내', met: true }] } },
        { turnNumber: 2, retryCount: 0, evaluation: { metItems: [{ item: '사과 표현', met: false }] } },
      ],
    }

    const result = buildSessionReportPayload({ session, staffName: '검증알바', industry: 'cafe' })

    expect(result.sessionId).toBe('s1')
    expect(result.staffName).toBe('검증알바')
    expect(result.industry).toBe('cafe')
    expect(result.scenarioTitle).toBe('품절 메뉴 대처')
    expect(result.durationMinutes).toBe(5)
    expect(result.checklist).toEqual([
      { label: 'ETA 안내', status: 'ok' },
      { label: '사과 표현', status: 'wait' },
    ])
  })

  it('completedAt이 없으면 durationMinutes는 null이다', () => {
    const session = {
      id: 's1',
      startedAt: new Date('2026-07-22T00:00:00.000Z'),
      completedAt: null,
      scenario: { title: 'x' },
      sessionTurns: [],
    }

    const result = buildSessionReportPayload({ session, staffName: '검증알바', industry: null })

    expect(result.durationMinutes).toBeNull()
    expect(result.checklist).toEqual([])
  })
})

describe('buildSessionSummary', () => {
  it('기준 충족 개수와 점수를 계산한다', () => {
    const sessionTurns = [
      { turnNumber: 1, retryCount: 0, evaluation: { metItems: [{ item: 'ETA 안내', met: true }] } },
      { turnNumber: 2, retryCount: 0, evaluation: { metItems: [{ item: '사과 표현', met: false }] } },
    ]

    const result = buildSessionSummary(sessionTurns)

    expect(result.passedCount).toBe(1)
    expect(result.totalCount).toBe(2)
    expect(result.score).toBe(75) // maxHearts 4, heartsRemaining 3 (computeHearts 테스트와 같은 케이스)
  })

  it('채점 기준이 하나도 없으면 점수는 null이다', () => {
    const result = buildSessionSummary([])

    expect(result.passedCount).toBe(0)
    expect(result.totalCount).toBe(0)
    expect(result.score).toBeNull()
  })
})

// 버그: 예전엔 "이번 답 하나가 필수 기준을 전부 커버했는가"로 재입력을 판정해서, 통과하는 순간
// 항상 세션도 같이 끝나버렸다(손님이 다음 대사를 할 기회가 코드상 존재하지 않았음).
// docs/multi-turn-conversation-fix.md — "이번 답이 뭔가 새로 채웠는가"로 기준을 바꾼다.
describe('decideTurnOutcome', () => {
  const requiredItems = ['사과', '안내']

  it('하트가 소진되면 진전 여부와 무관하게 즉시 종료된다', () => {
    const result = decideTurnOutcome({
      madeProgress: false,
      everMetItems: new Set(),
      requiredItems,
      turnNumber: 1,
      maxTurns: 3,
      heartsExhausted: true,
    })

    expect(result).toEqual({ retryNeeded: false, completed: true, allCriteriaMet: false })
  })

  it('아무 기준도 새로 못 채우면 같은 턴에 재입력이 필요하다', () => {
    const result = decideTurnOutcome({
      madeProgress: false,
      everMetItems: new Set(),
      requiredItems,
      turnNumber: 1,
      maxTurns: 3,
      heartsExhausted: false,
    })

    expect(result).toEqual({ retryNeeded: true, completed: false, allCriteriaMet: false })
  })

  it('일부 기준만 새로 채웠고 턴 한도 전이면 재입력 없이 다음 손님 대사로 넘어간다', () => {
    const result = decideTurnOutcome({
      madeProgress: true,
      everMetItems: new Set(['사과']), // '안내'는 아직 미충족
      requiredItems,
      turnNumber: 1,
      maxTurns: 3,
      heartsExhausted: false,
    })

    expect(result).toEqual({ retryNeeded: false, completed: false, allCriteriaMet: false })
  })

  it('필수 기준을 다 채우면 재입력 없이 바로 완료된다', () => {
    const result = decideTurnOutcome({
      madeProgress: true,
      everMetItems: new Set(['사과', '안내']),
      requiredItems,
      turnNumber: 1,
      maxTurns: 3,
      heartsExhausted: false,
    })

    expect(result).toEqual({ retryNeeded: false, completed: true, allCriteriaMet: true })
  })

  it('필수 기준을 다 못 채웠어도 턴 한도에 도달하면 강제 종료된다', () => {
    const result = decideTurnOutcome({
      madeProgress: true,
      everMetItems: new Set(['사과']),
      requiredItems,
      turnNumber: 3,
      maxTurns: 3,
      heartsExhausted: false,
    })

    expect(result).toEqual({ retryNeeded: false, completed: true, allCriteriaMet: false })
  })
})