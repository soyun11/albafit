import prisma from './prisma.js'

// 규칙 원문을 유사도 비교에 쓸 수 있게 토큰화한다. 형태소 분석 등 정교한 NLP는 쓰지 않는다 —
// 임베딩 API 없이 순수 텍스트 비교로 시작하기로 한 결정(docs/rubric-reuse.md) 그대로.
// 공백 개수·줄바꿈·문장부호 차이는 "같은 규칙"으로 봐야 하므로 비교 전에 없앤다.
export function normalizeRulesText(text) {
  return text
    .toLowerCase()
    .replace(/[.,!?~"'()]/g, '')
    .split(/\s+/)
    .filter(Boolean)
}

// 두 규칙 원문의 유사도를 자카드 유사도(교집합 크기 / 합집합 크기)로 계산한다.
// 오탐(잘못된 재사용)보다 놓침(재사용 안 하고 새로 생성)이 안전하다는 원칙에 따라, 비교할
// 근거가 없는 경우(둘 다 빈 문자열)는 유사도를 0으로 본다 — 1로 취급해 잘못 재사용되지 않도록.
export function computeTextSimilarity(textA, textB) {
  const tokensA = new Set(normalizeRulesText(textA))
  const tokensB = new Set(normalizeRulesText(textB))

  if (tokensA.size === 0 && tokensB.size === 0) return 0

  const intersectionSize = [...tokensA].filter((token) => tokensB.has(token)).length
  const unionSize = new Set([...tokensA, ...tokensB]).size

  return intersectionSize / unionSize
}

// 오탐(잘못된 재사용)보다 놓침(재사용 안 하고 새로 생성)이 안전하다는 원칙에 따라 보수적으로 높게
// 잡은 초기값. 실측 데이터 없이 미세 튜닝하지 않는다(docs/rubric-reuse.md 결정) — 나중에 재사용 로그를
// 쌓아보고서 조정한다.
export const SIMILARITY_THRESHOLD = 0.8

// candidates(각 { rawText, ...나머지 배치 정보 })중에서 targetRawText와의 유사도가 threshold
// 이상인 것 중 가장 높은 것 하나를 고른다. 없으면 null. 선택된 후보엔 similarityScore를 붙여
// 반환한다 — 왜 이 후보가 재사용됐는지 나중에 로깅/디버깅할 때 근거로 쓴다.
export function findBestReuseCandidate(candidates, targetRawText, threshold = SIMILARITY_THRESHOLD) {
  let best = null
  let bestScore = -1

  for (const candidate of candidates) {
    const score = computeTextSimilarity(candidate.rawText, targetRawText)
    if (score >= threshold && score > bestScore) {
      best = candidate
      bestScore = score
    }
  }

  return best ? { ...best, similarityScore: bestScore } : null
}

// 같은 업종의 다른 매장이 제출한 배치 중, "배치 안 모든 시나리오가 승인된 루브릭을 가진" 것만
// 재사용 후보로 본다(docs/rubric-reuse.md 결정 — 일부만 승인된 배치는 통째로 제외). 자기 매장의
// 과거 제출은 조회 조건에서 뺀다(다른 매장 간 재사용에만 집중).
// 반환값은 findBestReuseCandidate에 바로 넘길 수 있는 형태 + 실제 복제(POST /:linkKey/rules)에
// 필요한 시나리오·루브릭 데이터까지 포함한다 — 매칭된 뒤 다시 조회할 필요 없게.
export async function findReuseCandidateBatches({ industry, excludeStoreId }) {
  const storeRules = await prisma.storeRule.findMany({
    where: {
      store: { industry },
      storeId: { not: excludeStoreId },
    },
    include: {
      scenarios: { include: { rubrics: true } },
    },
  })

  return storeRules
    .filter((storeRule) => {
      if (storeRule.scenarios.length === 0) return false
      return storeRule.scenarios.every((scenario) => scenario.rubrics.some((rubric) => rubric.approvedAt !== null))
    })
    .map((storeRule) => ({
      storeRuleId: storeRule.id,
      rawText: storeRule.rawText,
      scenarios: storeRule.scenarios.map((scenario) => ({
        type: scenario.type,
        title: scenario.title,
        persona: scenario.persona,
        initialState: scenario.initialState,
        criteria: scenario.rubrics.find((rubric) => rubric.approvedAt !== null).criteria,
      })),
    }))
}
