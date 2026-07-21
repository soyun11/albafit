import { describe, it, expect } from 'vitest'
import { belongsToStaff } from './staffMatch.js'

const user = { id: 'user-1', name: '지우' }

describe('belongsToStaff', () => {
  it('staffId가 있으면 이름과 무관하게 staffId 일치 여부로 판단한다', () => {
    expect(belongsToStaff({ staffId: 'user-1', staffLabel: '다른이름' }, user)).toBe(true)
    expect(belongsToStaff({ staffId: 'user-2', staffLabel: '지우' }, user)).toBe(false)
  })

  it('staffId가 없으면(레거시 row) staffLabel과 이름 비교로 폴백한다', () => {
    expect(belongsToStaff({ staffId: null, staffLabel: '지우' }, user)).toBe(true)
    expect(belongsToStaff({ staffId: null, staffLabel: '다른이름' }, user)).toBe(false)
  })

  it('staffId도 staffLabel도 없으면 일치하지 않는다', () => {
    expect(belongsToStaff({ staffId: null, staffLabel: null }, user)).toBe(false)
    expect(belongsToStaff({ staffId: null, staffLabel: undefined }, user)).toBe(false)
  })
})
