import { Router } from 'express'
import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma.js'
import { generateLinkKey } from '../lib/linkKey.js'
import { generateRubric } from '../lib/rubric.js'

// Router() — express 앱 전체가 아니라 "이 파일 안에서만 쓰는 미니 라우터" 하나를 만듦.
// index.js에서 app.use('/api/stores', storesRouter)로 붙이면, 여기 정의된 '/'는 실제로 '/api/stores'가 됨.
const router = Router()

const MAX_LINK_KEY_RETRIES = 3 // link_key 중복 시 재시도할 최대 횟수

// MVP는 카페 1개로 축소 — docs/plan.md 기준 카페 시나리오 3종 고정
// 나중에 다른 업종이 추가되면 이 배열을 업종별로 분기해야 함(아직은 카페 하나뿐이라 그냥 상수로 둠)
const CAFE_SCENARIOS = [
  { type: 'delay', title: '음료 지연' },
  { type: 'out_of_stock', title: '품절 메뉴' },
  { type: 'rule_violation', title: '매장 규칙 위반 손님' },
]

// ============================================================
// 매장 링크 발급 — POST /api/stores
// (프론트에서 사장님이 "매장 만들기" 누르면 이 API가 호출됨)
// ============================================================
router.post('/', async (req, res) => {
  // req(request) = 클라이언트가 보낸 요청. req.body = 요청 본문(JSON으로 보낸 데이터).
  // res(response) = 우리가 클라이언트한테 돌려줄 응답 객체.
  // async 함수라서 안에서 await(비동기 대기)를 쓸 수 있음 — DB 작업은 시간이 걸리니 await로 "끝날 때까지 기다렸다가 다음 줄 실행".

  // 구조분해 할당: req.body 안에 있는 industry, name 값을 바로 꺼내서 변수로 만듦.
  // req.body가 아예 없을 수도 있어서(예: body를 안 보낸 요청) `?? {}`로 "없으면 빈 객체로 취급"해서 에러를 막음.
  const { industry, name } = req.body ?? {}

  // 입력값 검증 — 프론트가 이상한 값을 보내도 DB까지 안 가고 여기서 걸러냄
  // industry가 "왔는데(undefined가 아닌데) 문자열이 아니거나 너무 길면" 에러
  if (industry !== undefined && (typeof industry !== 'string' || industry.length > 50)) {
    // res.status(400) = HTTP 상태코드 400(잘못된 요청)을 설정하고, .json(...)으로 에러 메시지를 JSON으로 응답.
    // return을 안 붙이면 이 코드 아래도 계속 실행되므로, 여기서 함수를 끝내기 위해 꼭 return 씀.
    return res.status(400).json({ error: 'industry must be a string of 50 characters or fewer' })
  }
  if (name !== undefined && (typeof name !== 'string' || name.length > 100)) {
    return res.status(400).json({ error: 'name must be a string of 100 characters or fewer' })
  }

  // link_key는 랜덤 문자열이라 이론상 아주 드물게 다른 매장이랑 겹칠 수 있음(DB에 unique 제약이 걸려있음).
  // 그래서 "겹치면 새로 뽑아서 다시 시도"를 최대 3번까지 반복하는 for문.
  for (let attempt = 0; attempt < MAX_LINK_KEY_RETRIES; attempt++) {
    try {
      // prisma.store.create({...}) — stores 테이블에 새 row 하나를 만드는 Prisma 명령.
      // await를 붙였으니 "DB에 실제로 저장될 때까지" 여기서 기다림.
      const store = await prisma.store.create({
        data: {
          linkKey: generateLinkKey(), // 매번 새 랜덤 링크 생성
          // 스프레드 문법(...) + 조건: industry가 있을 때만 { industry: 값 }을 객체에 끼워 넣음.
          // industry가 undefined면 `false && {...}`가 되어 아무것도 안 끼워짐(Prisma에 아예 안 보냄 → DB 기본값 사용).
          ...(industry !== undefined && { industry }),
          ...(name !== undefined && { name }),
        },
      })
      // 저장 성공 — 201(생성됨) 상태코드와 함께 만들어진 store 정보를 그대로 응답.
      // 여기서 return 하니까 아래 for문 반복이나 catch로 안 내려가고 함수가 바로 끝남.
      return res.status(201).json(store)
    } catch (err) {
      // create가 실패하면(주로 link_key가 겹쳤을 때) 여기로 옴.
      // Prisma가 unique 제약 위반일 때 던지는 에러 코드가 'P2002'.
      // err.meta?.target — 이 ?.는 "옵셔널 체이닝". err.meta가 없으면(undefined/null) 에러 안 내고 그냥 undefined를 반환함.
      //   즉 "err.meta가 있으면 그 안의 target을 보고, 없으면 그냥 undefined"라서 .includes()를 안전하게 이어 쓸 수 있음.
      const isLinkKeyConflict =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        err.meta?.target?.includes('link_key')

      if (!isLinkKeyConflict) {
        // link_key 충돌이 아닌 다른 종류의 에러라면 재시도해봤자 소용없으니 바로 실패 응답
        console.error(err) // 서버 콘솔에 실제 에러 내용을 남겨서 나중에 디버깅할 수 있게 함
        return res.status(500).json({ error: 'failed to create store' })
      }
      // isLinkKeyConflict가 true면 여기서 아무것도 return 안 하고 그냥 for문의 다음 반복(attempt+1)으로 넘어감
    }
  }

  // for문을 3번 다 돌았는데도 성공(return)을 못 했다는 건 3번 다 충돌났다는 뜻 — 이례적인 경우라 500으로 처리
  return res.status(500).json({ error: 'failed to create store' })
})

// ============================================================
// 매장 조회 — GET /api/stores/:linkKey
// (알바가 매장 링크로 들어왔을 때, 그 링크가 진짜 있는 매장인지 확인할 때 씀)
// ============================================================
router.get('/:linkKey', async (req, res) => {
  // 라우트 경로의 ':linkKey' 부분 — URL이 /api/stores/abc123이면 req.params.linkKey는 'abc123'이 됨.
  try {
    const store = await prisma.store.findUnique({ where: { linkKey: req.params.linkKey } })
    // findUnique는 못 찾으면 에러를 던지지 않고 그냥 null을 돌려줌 — 그래서 직접 null 체크를 해줘야 함.
    if (!store) {
      return res.status(404).json({ error: 'store not found' }) // 404 = "그런 리소스 없음"
    }
    return res.json(store) // 상태코드를 따로 안 주면 기본값 200(성공)
  } catch (err) {
    // DB 연결이 끊기는 등 예상 못 한 에러가 나면 여기로 옴
    console.error(err)
    return res.status(500).json({ error: 'failed to fetch store' })
  }
})

// ============================================================
// 규칙 원문 저장 + 루브릭 자동 생성 — POST /api/stores/:linkKey/rules
// (사장님이 규칙확인 화면 이전 단계에서 "매뉴얼/규정 텍스트"를 제출했을 때 호출되는 API)
// 흐름: 규칙 저장 → 지금까지 쌓인 규칙 전부 모으기 → 카페 시나리오 3개마다 Gemini로 루브릭 생성 → 저장
// ============================================================
router.post('/:linkKey/rules', async (req, res) => {
  const { linkKey } = req.params // URL 경로에서 매장 링크 꺼냄
  const { category, rawText } = req.body ?? {} // 요청 body에서 규칙 원문(그리고 선택적으로 카테고리) 꺼냄

  // 입력값 검증 — rawText는 필수, category는 선택
  if (typeof rawText !== 'string' || rawText.trim().length === 0) {
    // trim()으로 앞뒤 공백을 지운 뒤 길이가 0이면 "빈 값이나 다름없다"고 판단
    return res.status(400).json({ error: 'rawText is required' })
  }
  if (category !== undefined && (typeof category !== 'string' || category.length > 50)) {
    return res.status(400).json({ error: 'category must be a string of 50 characters or fewer' })
  }

  try {
    // 1단계: 링크로 매장이 실제로 존재하는지 확인 (없는 링크로 규칙을 저장하려는 요청을 막음)
    const store = await prisma.store.findUnique({ where: { linkKey } })
    if (!store) {
      return res.status(404).json({ error: 'store not found' })
    }

    // 2단계: 규칙 원문을 store_rules 테이블에 새 row로 저장.
    // CLAUDE.md 원칙 — "원문은 지우지 않는다": 루브릭으로 변환한 뒤에도 원문 자체는 그대로 남겨둬야
    // 나중에 사장님이 규칙을 고치거나 루브릭을 다시 만들 때 원본을 참고할 수 있음.
    const storeRule = await prisma.storeRule.create({
      data: {
        storeId: store.id, // 이 규칙이 어느 매장 것인지 연결(외래키)
        ...(category !== undefined && { category }), // category가 있을 때만 포함
        rawText,
      },
    })

    // 3단계: 이번에 새로 저장한 규칙 하나만이 아니라, 이 매장이 "지금까지 입력한 규칙 전부"를 다시 불러옴.
    // findMany = 조건에 맞는 row를 배열로 전부 가져오는 Prisma 명령(findUnique/findFirst는 하나만, findMany는 여러 개).
    const allRules = await prisma.storeRule.findMany({ where: { storeId: store.id } })
    // allRules는 [{rawText: '...'}, {rawText: '...'}, ...] 같은 객체 배열.
    // .map()으로 각 row에서 rawText 문자열만 뽑아 새 배열을 만들고, .join('\n\n')으로 그 문자열들을 줄바꿈 두 번으로 이어붙임.
    // 즉 "규칙 여러 개를 한 덩어리의 긴 텍스트"로 합치는 것 — Gemini 프롬프트에 그대로 넣기 위해서.
    const combinedRulesText = allRules.map((rule) => rule.rawText).join('\n\n')

    // 4단계: 카페 시나리오 3개(지연/품절/규칙위반)마다 각각 루브릭을 만들어야 함.
    // 그런데 각 시나리오의 "Gemini한테 루브릭 만들어달라고 부탁하는" 부분이 실제로 20초 넘게 걸림(직접 테스트로 확인함).
    // 만약 for문으로 하나씩 순서대로(await 걸어가며) 처리하면 3개 * 20초 = 60초 넘게 걸려서 사용자가 너무 오래 기다려야 함.
    //
    // Promise.all(배열) — 배열 안의 여러 비동기 작업을 "동시에 전부 시작"시켜놓고, 그 작업들이 "다 끝날 때까지"만 기다림.
    // 세 시나리오는 서로 결과를 참조하지 않는 완전히 독립적인 작업이라 병렬로 돌려도 안전함.
    // 이렇게 하면 전체 소요 시간이 (3개 합) 대신 (가장 오래 걸리는 것 1개) 정도로 줄어듦.
    //
    // CAFE_SCENARIOS.map(async (scenarioDef) => {...}) — 시나리오 배열의 각 항목마다 "비동기 작업 함수"를 하나씩 만들어서
    // [Promise, Promise, Promise] 형태의 배열을 만들고, 그걸 Promise.all에 넘김.
    const rubrics = await Promise.all(
      CAFE_SCENARIOS.map(async (scenarioDef) => {
        // 4-1. 이 매장에 해당 타입(예: 'delay')의 시나리오가 이미 DB에 있는지 확인.
        // findFirst = 조건에 맞는 것 중 첫 번째 하나만 가져옴(여러 개 있어도 첫 번째만).
        let scenario = await prisma.scenario.findFirst({
          where: { storeId: store.id, type: scenarioDef.type },
        })
        // 없으면(scenario가 null이면) 새로 만듦 — 매장이 처음 규칙을 등록할 때만 이 분기를 타고,
        // 두 번째부터는 이미 있으니 새로 안 만들고 기존 것을 재사용함.
        if (!scenario) {
          scenario = await prisma.scenario.create({
            data: {
              storeId: store.id,
              type: scenarioDef.type,
              title: scenarioDef.title,
              persona: {}, // 손님 역할의 성격·말투 — 아직 안 만들어서 빈 객체로 둠(나중에 채울 자리)
              initialState: {}, // 시나리오 시작 시점의 상태(주문 상태 등) — 아직 안 만들어서 빈 객체
            },
          })
        }

        // 4-2. 실제 LLM 호출 — server/src/lib/rubric.js의 generateRubric 함수를 불러서 씀.
        // 규칙 원문(combinedRulesText)과 이 시나리오 정보를 넘기면, Gemini가 만든 채점 기준 배열을 돌려받음.
        const criteria = await generateRubric({
          scenarioType: scenarioDef.type,
          scenarioTitle: scenarioDef.title,
          rawRulesText: combinedRulesText,
        })

        // 4-3. 같은 시나리오에 이미 루브릭이 있으면(사장님이 예전에도 규칙을 등록한 적 있으면) 버전 번호를 하나 올림.
        // orderBy: { version: 'desc' } — version이 큰 순서(내림차순)로 정렬해서 findFirst로 가장 최신 걸 가져옴.
        const latestRubric = await prisma.rubric.findFirst({
          where: { scenarioId: scenario.id },
          orderBy: { version: 'desc' },
        })
        // latestRubric?.version — 옵셔널 체이닝. latestRubric이 null이면 undefined.
        // (undefined) ?? 0 — nullish 병합. 왼쪽이 null/undefined일 때만 오른쪽 값(0)을 씀.
        // 즉 "이전 루브릭이 있으면 그 버전 + 1, 없으면(처음이면) 1"이 됨.
        const nextVersion = (latestRubric?.version ?? 0) + 1

        // 4-4. 새 루브릭을 DB에 저장. 이 map 콜백 함수 자체가 async라서, 여기서 return한 값이
        // Promise.all이 만드는 배열(rubrics)의 한 원소가 됨.
        // approvedAt: null — db-schema.md 설계대로 "AI가 막 만든 승인 전 초안" 상태를 의미함.
        // 나중에 사장님이 루브릭승인 화면에서 승인 버튼을 누르면 이 값이 실제 승인 시각으로 채워지는 API가 따로 필요함(아직 없음).
        return prisma.rubric.create({
          data: {
            scenarioId: scenario.id,
            criteria, // Gemini가 만들어준 JSON 배열을 그대로 JSONB 컬럼에 저장
            version: nextVersion,
            approvedAt: null,
          },
        })
      })
    )
    // 여기까지 오면 rubrics는 [루브릭1, 루브릭2, 루브릭3] 형태의 배열(시나리오 3개 * 각각의 저장 결과)

    // 저장한 규칙 원문 + 새로 만든 루브릭 3개를 한 번에 응답으로 돌려줌
    return res.status(201).json({ storeRule, rubrics })
  } catch (err) {
    // store 조회부터 루브릭 저장까지 이 try 블록 안 어디서든 에러가 나면 전부 여기로 옴
    console.error(err)
    return res.status(500).json({ error: 'failed to save rules and generate rubric' })
  }
})

export default router
