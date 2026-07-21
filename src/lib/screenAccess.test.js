import { describe, it, expect } from 'vitest'
import { isScreenAllowed, landingScreenFor } from './screenAccess.js'

const owner = { role: 'owner', storeId: 'store-1' }
const ownerNoStore = { role: 'owner', storeId: null }
const staff = { role: 'staff' }

describe('isScreenAllowed', () => {
  it('사장님 전용 화면은 owner만 허용한다', () => {
    expect(isScreenAllowed('dashboard', owner)).toBe(true)
    expect(isScreenAllowed('dashboard', staff)).toBe(false)
    expect(isScreenAllowed('dashboard', null)).toBe(false)
  })

  it('알바 전용 화면은 staff만 허용한다', () => {
    expect(isScreenAllowed('training', staff)).toBe(true)
    expect(isScreenAllowed('training', owner)).toBe(false)
    expect(isScreenAllowed('training', null)).toBe(false)
  })

  it('로그인만 하면 되는 공용 화면(changePassword, feedback)은 역할 무관 허용, 비로그인은 차단한다', () => {
    expect(isScreenAllowed('changePassword', owner)).toBe(true)
    expect(isScreenAllowed('changePassword', staff)).toBe(true)
    expect(isScreenAllowed('changePassword', null)).toBe(false)

    expect(isScreenAllowed('feedback', owner)).toBe(true)
    expect(isScreenAllowed('feedback', staff)).toBe(true)
    expect(isScreenAllowed('feedback', null)).toBe(false)
  })

  it('완전 공용 화면(landing, login 등)은 로그인 여부·역할과 무관하게 항상 허용한다', () => {
    expect(isScreenAllowed('landing', null)).toBe(true)
    expect(isScreenAllowed('landing', owner)).toBe(true)
    expect(isScreenAllowed('login', null)).toBe(true)
    expect(isScreenAllowed('guestTry', staff)).toBe(true)
  })
})

describe('landingScreenFor', () => {
  it('비로그인이면 login으로 보낸다', () => {
    expect(landingScreenFor(null)).toBe('login')
  })

  it('매장이 없는 사장님은 industry로 보낸다', () => {
    expect(landingScreenFor(ownerNoStore)).toBe('industry')
  })

  it('매장이 있는 사장님은 dashboard로 보낸다', () => {
    expect(landingScreenFor(owner)).toBe('dashboard')
  })

  it('알바는 scenario로 보낸다', () => {
    expect(landingScreenFor(staff)).toBe('scenario')
  })
})
