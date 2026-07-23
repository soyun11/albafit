import { describe, it, expect } from 'vitest'
import { parseAIJson } from './aiJson.js'

describe('parseAIJson', () => {
  it('정상 케이스: 순수 JSON 텍스트를 그대로 파싱한다', () => {
    const result = parseAIJson('{"item": "인사말", "met": true}')
    expect(result).toEqual({ item: '인사말', met: true })
  })

  it('코드펜스로 감싸진 JSON도(```json ... ```) 펜스를 벗기고 파싱한다', () => {
    const text = '```json\n{"item": "포장 확인", "met": false}\n```'
    const result = parseAIJson(text)
    expect(result).toEqual({ item: '포장 확인', met: false })
  })

  it('언어 표시 없는 코드펜스(``` ... ```)도 벗기고 파싱한다', () => {
    const text = '```\n{"a": 1}\n```'
    expect(parseAIJson(text)).toEqual({ a: 1 })
  })

  it('JSON이 아닌 텍스트가 오면, 원인을 알 수 있는 명확한 에러를 던진다', () => {
    expect(() => parseAIJson('이건 JSON이 아니에요')).toThrow(/AI 응답을 JSON으로 파싱하지 못했습니다/)
  })

  it('빈 문자열이 오면 파싱 실패로 명확한 에러를 던진다', () => {
    expect(() => parseAIJson('')).toThrow(/AI 응답을 JSON으로 파싱하지 못했습니다/)
  })

  it('null/undefined가 오면 크래시 대신 같은 종류의 에러를 던진다', () => {
    expect(() => parseAIJson(null)).toThrow(/AI 응답을 JSON으로 파싱하지 못했습니다/)
    expect(() => parseAIJson(undefined)).toThrow(/AI 응답을 JSON으로 파싱하지 못했습니다/)
  })
})
