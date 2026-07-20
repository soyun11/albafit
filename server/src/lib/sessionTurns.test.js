import { describe, it, expect } from 'vitest'
import { pickFinalAttempts, buildConversationHistory, computeHearts } from './sessionTurns.js'

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