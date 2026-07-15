import 'dotenv/config'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { generateRubric } from '../src/lib/rubric.js'

// 회귀 확인용 스크립트다 — 통과/실패를 강제하는 테스트가 아니라, generateRubric() 프롬프트를 바꿀 때
// "예전이랑 비슷한 결과가 나오는지" 사람이 눈으로 비교하기 위한 리포트를 찍어준다.
// Vitest는 아직 안 붙이기로 한 시점(CLAUDE.md)이라 plain node 스크립트로 둔다.
//
// 사용법: node eval/run-rubric-eval.js [개수]
// Gemini 호출 하나당 무료 티어 일일 할당량을 쓰므로, 기본은 전체가 아니라 앞에서 3개만 돈다.
// 전부 돌리려면: node eval/run-rubric-eval.js all

const __dirname = dirname(fileURLToPath(import.meta.url))
const evalSet = JSON.parse(readFileSync(join(__dirname, 'rubric-eval-set.json'), 'utf-8'))

const arg = process.argv[2]
const cases = arg === 'all' ? evalSet : evalSet.slice(0, Number(arg) || 3)

function checkKeywords(criteria, expectedKeywords) {
  const haystack = criteria
    .map((c) => `${c.item} ${c.good_example} ${c.bad_example}`)
    .join(' ')
    .toLowerCase()
  const found = expectedKeywords.filter((kw) => haystack.includes(kw.toLowerCase()))
  return { found, missing: expectedKeywords.filter((kw) => !found.includes(kw)) }
}

async function main() {
  console.log(`${cases.length}개 케이스 실행 (전체 ${evalSet.length}개 중)\n`)
  let totalKeywords = 0
  let foundKeywords = 0

  for (const testCase of cases) {
    process.stdout.write(`[${testCase.id}] `)
    try {
      const criteria = await generateRubric({
        scenarioType: testCase.scenarioType,
        scenarioTitle: testCase.scenarioTitle,
        rawRulesText: testCase.rawRulesText,
      })

      const { found, missing } = checkKeywords(criteria, testCase.expectedKeywords)
      totalKeywords += testCase.expectedKeywords.length
      foundKeywords += found.length

      console.log(`criteria ${criteria.length}개 생성, 키워드 ${found.length}/${testCase.expectedKeywords.length} 커버`)
      criteria.forEach((c) => console.log(`  - [${c.required ? '필수' : '선택'}] ${c.item}`))
      if (missing.length > 0) console.log(`  못 찾은 키워드: ${missing.join(', ')}`)
      console.log()
    } catch (err) {
      console.log(`실패: ${err.message}\n`)
    }
  }

  console.log(`전체 키워드 커버리지: ${foundKeywords}/${totalKeywords}`)
}

main()
