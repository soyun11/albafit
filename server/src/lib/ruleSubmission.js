// 규칙 제출(POST /:linkKey/rules)의 DB 쓰기 부분만 담당하는 순수 함수. AI 호출(proposeScenarios·
// generateRubric)은 이 함수를 부르기 전에 이미 끝나있어야 한다 — batch에 결과가 다 채워진 채로 들어온다.
// 이 파일은 AI lib을 import하지 않는다 — 그래서 트랜잭션 안에 AI 호출이 섞일 수 없음이 코드
// 구조로 보장된다(docs/rule-submission-transaction.md).
//
// tx는 prisma.$transaction(async (tx) => ...)가 넘겨주는 트랜잭션 클라이언트. storeRule 생성이
// 실패하거나 batch 안 시나리오/루브릭 생성 중 하나라도 실패하면 이 함수가 reject되고, 그러면
// $transaction이 전체를 롤백한다 — 부분 데이터가 DB에 남지 않는다(soyun11/hub#8).
//
// @param {object} tx
// @param {{ storeId: string, rawText: string, category?: string, items?: object[],
//           batch: Array<{ scenario: object, rubric: object }> }} params
export async function submitRuleBatch(tx, { storeId, rawText, category, items, batch }) {
  const storeRule = await tx.storeRule.create({
    data: {
      storeId,
      ...(category !== undefined && { category }),
      ...(items !== undefined && { items }),
      rawText,
    },
  })

  const rubrics = []
  for (const { scenario, rubric } of batch) {
    const createdScenario = await tx.scenario.create({
      data: { storeId, storeRuleId: storeRule.id, ...scenario },
    })
    const createdRubric = await tx.rubric.create({
      data: { scenarioId: createdScenario.id, ...rubric },
    })
    rubrics.push({
      ...createdRubric,
      scenarioTitle: scenario.title,
      situation: scenario.persona?.situation,
      opening: scenario.persona?.opening,
    })
  }

  return { storeRule, rubrics }
}
