import { describe, it, expect } from 'vitest'
import { parseRulesText } from './RulesInput.jsx'

describe('parseRulesText', () => {
  it('정상 케이스: "제목: 내용" 청크 1개를 넣으면 title/example이 정확히 나뉘어 SAVED 라벨 카드 1개로 변환된다', () => {
    const result = parseRulesText('인사말: 어서오세요로 시작해요')
    expect(result).toEqual([
      { id: 'saved-0', label: 'SAVED', title: '인사말', example: '어서오세요로 시작해요', mascot: 'approve', enabled: true },
    ])
  })

  it('정상 케이스: 서로 다른 값의 청크 3개를 "\\n\\n"으로 이어 넣으면 각 청크가 원래 순서 그대로 title/example이 매칭되고 id도 saved-0/1/2로 순서대로 매겨진다', () => {
    const result = parseRulesText('인사말: 어서오세요\n\n포장 확인: 포장이세요?\n\n환불 규정: 영수증 필요해요')

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ id: 'saved-0', label: 'SAVED', title: '인사말', example: '어서오세요', mascot: 'approve', enabled: true })
    expect(result[1]).toEqual({ id: 'saved-1', label: 'SAVED', title: '포장 확인', example: '포장이세요?', mascot: 'approve', enabled: true })
    expect(result[2]).toEqual({ id: 'saved-2', label: 'SAVED', title: '환불 규정', example: '영수증 필요해요', mascot: 'approve', enabled: true })
  })

  it('빈 값: rawText가 빈 문자열("")이면 파싱할 내용이 없으므로 빈 배열을 반환한다', () => {
    expect(parseRulesText('')).toEqual([])
  })

  it('빈 값: rawText가 null이면 "rawText ?? \'\'" 방어 코드 덕분에 에러 없이 빈 배열을 반환한다', () => {
    expect(parseRulesText(null)).toEqual([])
  })

  it('빈 값: rawText가 undefined면(호출자가 값을 아예 안 넘긴 경우) 에러 없이 빈 배열을 반환한다', () => {
    expect(parseRulesText(undefined)).toEqual([])
  })

  it('빈 값: 공백·개행 문자만 있는 문자열("   \\n  ")은 trim 후 빈 문자열이 되어 빈 배열을 반환한다', () => {
    expect(parseRulesText('   \n  ')).toEqual([])
  })

  it('경계값: 구분자(": ")가 전혀 없는 청크는(라벨링 체계 도입 전 자유 텍스트로 저장된 레거시 규칙 같은 경우) "규정 1" 폴백 제목이 붙고 청크 전체가 example이 된다', () => {
    const result = parseRulesText('반려동물은 캐리어에 들어가 있어야 입장 가능해요')
    expect(result).toEqual([
      {
        id: 'saved-0',
        label: 'SAVED',
        title: '규정 1',
        example: '반려동물은 캐리어에 들어가 있어야 입장 가능해요',
        mascot: 'approve',
        enabled: true,
      },
    ])
  })

  it('경계값: 한 청크 안에 ": "가 두 번 나오면(예시 문장 안에 콜론이 또 들어간 경우) 첫 번째 ": "에서만 title/example이 나뉘고 두 번째 ": " 이후는 example에 그대로 남는다', () => {
    const result = parseRulesText('출입 확인: 반려동물 캐리어 필요: 확인 후 입장')
    expect(result[0].title).toBe('출입 확인')
    expect(result[0].example).toBe('반려동물 캐리어 필요: 확인 후 입장')
  })

  it('경계값: 저장된 규칙이 하나뿐이라 "\\n\\n" 구분자 자체가 없으면 청크 분리 없이 카드 1개짜리 배열을 반환한다', () => {
    const result = parseRulesText('마감 안내: 30분 전 라스트오더 안내해요')
    expect(result).toHaveLength(1)
  })

  // 실제로 이 모양이 생기는 경로: handleConfirm(RulesInput.jsx:165)이 규칙을 저장할 때
  // `title + ": " + example`을 "\n\n"으로 이어붙인다. 사용자가 어떤 규칙의 example(예시 설명)을
  // 여러 문단으로 나눠 쓰면서 그 안에 빈 줄을 하나 넣으면, "이 규칙 예시 끝의 \n\n" + "다음 규칙
  // 시작 전의 \n\n"가 겹쳐서 원문에 "\n\n\n\n"이 생긴다.
  //
  // 이 입력을 그냥 .split('\n\n')만 하면 ['인사말: 어서오세요', '', '포장 확인: 포장이세요?'] —
  // 가운데 빈 문자열 청크가 끼어든다. 수정 전 코드는 이 빈 청크도 그대로 카드로 만들어서
  // example이 빈 "유령 카드"가 목록 중간에 보이는 버그였다(케이스 10번). 지금은
  // `.filter(chunk => chunk)`로 빈 청크를 map 하기 *전에* 걸러내서 카드 자체가 안 생긴다.
  //
  // result[1].id가 'saved-2'가 아니라 'saved-1'인 게 이 테스트의 핵심 assertion이다.
  // 만약 filter를 map 뒤에 했다면(잘못된 구현) 인덱스는 원본 배열 기준(0,1,2)으로 매겨진 채
  // 빈 것만 나중에 빠져서 saved-0, saved-2처럼 번호에 구멍이 생겼을 것이다. saved-1이 나온다는
  // 건 "filter가 인덱스 매기기보다 먼저 실행됐다"를 실제로 증명하는 값이다.
  it('버그 수정 확인: example에 빈 줄이 섞여 원문에 "\\n\\n\\n\\n"이 생겨도(handleConfirm 저장 형식 기준) 빈 청크는 걸러지고, saved-2가 아니라 saved-1로 인덱스에 구멍 없이 매겨진다', () => {
    const result = parseRulesText('인사말: 어서오세요\n\n\n\n포장 확인: 포장이세요?')

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ id: 'saved-0', label: 'SAVED', title: '인사말', example: '어서오세요', mascot: 'approve', enabled: true })
    expect(result[1]).toEqual({ id: 'saved-1', label: 'SAVED', title: '포장 확인', example: '포장이세요?', mascot: 'approve', enabled: true })
  })

  it('버그 수정 확인: 청크 앞뒤에 공백이 남아있어도("  포장 확인: 포장이세요?  ") 개별 trim 덕분에 title/example에 불필요한 공백이 섞이지 않는다', () => {
    const result = parseRulesText('인사말: 어서오세요\n\n  포장 확인: 포장이세요?  ')
    expect(result[1].title).toBe('포장 확인')
    expect(result[1].example).toBe('포장이세요?')
  })

  it('버그 아님(의도된 폴백): 콜론은 있지만 뒤에 공백이 없으면(":"이지 ": "가 아님) 구분자로 인식하지 않고 "규정 1" 폴백 제목으로 처리한다 — 7번 레거시 케이스와 같은 경로', () => {
    const result = parseRulesText('출입확인:반려동물 캐리어 필요')
    expect(result).toEqual([
      {
        id: 'saved-0',
        label: 'SAVED',
        title: '규정 1',
        example: '출입확인:반려동물 캐리어 필요',
        mascot: 'approve',
        enabled: true,
      },
    ])
  })
})
