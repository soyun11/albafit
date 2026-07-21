import { Router } from 'express'
import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma.js'
import { generateLinkKey } from '../lib/linkKey.js'
import { generateRubric } from '../lib/rubric.js'
import { proposeScenarios } from '../lib/scenarioProposer.js'
import { findReuseCandidateBatches, findBestReuseCandidate } from '../lib/rubricReuse.js'
import { splitManualRules } from '../lib/manualRules.js'
import { hashPassword, signAccessToken } from '../lib/auth.js'
import { requireAuth, requireRole } from '../middleware/requireAuth.js'
import { pickFinalAttempts, computeHearts } from '../lib/sessionTurns.js'

// Router() — express 앱 전체가 아니라 "이 파일 안에서만 쓰는 미니 라우터" 하나를 만듦.
// index.js에서 app.use('/api/stores', storesRouter)로 붙이면, 여기 정의된 '/'는 실제로 '/api/stores'가 됨.
const router = Router()

const MAX_LINK_KEY_RETRIES = 3 // link_key 중복 시 재시도할 최대 횟수

// 이 매장이 가장 최근에 제출한 규칙(StoreRule)의 id — "지금 이 매장의 현재 시나리오 배치"를 가려낼 때
// 쓰는 기준이다. 규칙을 재설정할 때마다 시나리오를 새로 만들기 때문에(POST /:linkKey/rules), 여러
// 조회(훈련 가능한 시나리오 목록, 루브릭 관리, 진행률 집계)가 전부 이 기준으로 "최신 배치만" 걸러야
// 재설정을 여러 번 한 매장에서 예전 배치와 최신 배치가 섞이지 않는다.
async function getLatestStoreRuleId(storeId) {
  const latest = await prisma.storeRule.findFirst({
    where: { storeId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })
  return latest?.id ?? null
}

// ============================================================
// 매장 링크 발급 — POST /api/stores
// (프론트에서 사장님이 "매장 만들기" 누르면 이 API가 호출됨)
// ============================================================
router.post('/', requireAuth, requireRole('owner'), async (req, res) => {
  // req(request) = 클라이언트가 보낸 요청. req.body = 요청 본문(JSON으로 보낸 데이터).
  // res(response) = 우리가 클라이언트한테 돌려줄 응답 객체.
  // async 함수라서 안에서 await(비동기 대기)를 쓸 수 있음 — DB 작업은 시간이 걸리니 await로 "끝날 때까지 기다렸다가 다음 줄 실행".

  // 이미 매장이 있는 사장님이 또 만들면, 기존 매장은 DB에 남아있지만 이 계정의 storeId만 새 매장으로
  // 덮어써져서 사실상 못 찾는 매장이 된다(고아 상태) — 그걸 막는다.
  if (req.user.storeId) {
    return res.status(409).json({ error: 'you already have a store' })
  }

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

      // 이 매장을 만든 사장님 계정에 storeId를 연결 — 이게 있어야 다음 로그인부터 자기 매장을 바로 찾는다.
      const owner = await prisma.user.update({
        where: { id: req.user.id },
        data: { storeId: store.id },
      })

      // req.user(토큰 안 값)는 storeId가 비어있던 옛날 값이라, 새 storeId를 담아 액세스 토큰을 다시
      // 발급해서 프론트가 이 응답의 accessToken으로 갈아끼우면 그 다음 요청부터 바로 이 매장 소속으로
      // 인증된다. 리프레시 토큰은 storeId를 담지 않으므로(로그인 상태 유지 전용) 그대로 둔다.
      const accessToken = signAccessToken(owner)

      // 저장 성공 — 201(생성됨) 상태코드와 함께 만들어진 store 정보와 갱신된 accessToken을 응답.
      // 여기서 return 하니까 아래 for문 반복이나 catch로 안 내려가고 함수가 바로 끝남.
      return res.status(201).json({ store, accessToken })
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
// 매뉴얼 원문 분리 — POST /api/stores/manual-split (사장님 전용)
// 업종선택 화면에서 매장 매뉴얼을 통째로 입력하면, 다음 화면(규칙확인)에 카드 하나로 뭉뚱그려
// 보여주는 대신 Gemini로 규칙 단위 여러 개(제목+내용)로 나눠서 보여준다.
// 아직 매장을 안 만들었을 수도 있는 시점(업종선택 화면)이라 storeId는 필요 없다.
// ============================================================
router.post('/manual-split', requireAuth, requireRole('owner'), async (req, res) => {
  const { manualText } = req.body ?? {}
  if (typeof manualText !== 'string' || manualText.trim().length === 0) {
    return res.status(400).json({ error: 'manualText is required' })
  }

  try {
    const rules = await splitManualRules({ manualText: manualText.trim() })
    return res.json({ rules })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'failed to split manual text' })
  }
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
// 규칙 원문 저장 + 루브릭 자동 생성 — POST /api/stores/:linkKey/rules (사장님 전용)
// (사장님이 규칙확인 화면 이전 단계에서 "매뉴얼/규정 텍스트"를 제출했을 때 호출되는 API)
// 흐름: 규칙 저장 → AI가 규칙 기반으로 시나리오 상황 제안(proposeScenarios) → 제안된 상황마다 Gemini로 루브릭 생성 → 저장
//
// requireAuth + 소유권 확인 필수 — 원래 이 라우트에 인증이 아예 없어서, linkKey만 알면 누구나
// 남의 매장에 규칙을 밀어넣고 Gemini를 여러 번(시나리오 제안 1번 + 시나리오 수만큼 루브릭 생성) 호출시킬 수 있었다.
// Gemini 무료 티어 일일 한도가 20회뿐이라(직접 겪음) 악용되면 서비스 전체 AI 기능이 마비될 수 있는 진짜 보안 문제였다.
// ============================================================
router.post('/:linkKey/rules', requireAuth, requireRole('owner'), async (req, res) => {
  const { linkKey } = req.params // URL 경로에서 매장 링크 꺼냄
  const { category, rawText, items } = req.body ?? {} // 요청 body에서 규칙 원문(그리고 선택적으로 카테고리·카드별 원본) 꺼냄

  // 입력값 검증 — rawText는 필수, category·items는 선택
  if (typeof rawText !== 'string' || rawText.trim().length === 0) {
    // trim()으로 앞뒤 공백을 지운 뒤 길이가 0이면 "빈 값이나 다름없다"고 판단
    return res.status(400).json({ error: 'rawText is required' })
  }
  if (category !== undefined && (typeof category !== 'string' || category.length > 50)) {
    return res.status(400).json({ error: 'category must be a string of 50 characters or fewer' })
  }
  // items — "기준 재설정"에서 원래 라벨 그대로 복원하기 위한 카드별 원본 배열. 예전 클라이언트는 아예
  // 안 보낼 수도 있어서(하위호환) undefined면 그냥 통과시키고, 보냈는데 배열이 아니면만 막는다.
  if (items !== undefined && !Array.isArray(items)) {
    return res.status(400).json({ error: 'items must be an array' })
  }

  try {
    // 1단계: 링크로 매장이 실제로 존재하는지 확인 (없는 링크로 규칙을 저장하려는 요청을 막음)
    const store = await prisma.store.findUnique({ where: { linkKey } })
    if (!store) {
      return res.status(404).json({ error: 'store not found' })
    }
    // 로그인은 했지만 이 매장 소유자가 아니면 막는다 — 로그인 여부만 확인하는 걸론 부족하다.
    if (store.id !== req.user.storeId) {
      return res.status(403).json({ error: 'store does not belong to you' })
    }

    // 2단계: 규칙 원문을 store_rules 테이블에 새 row로 저장.
    // CLAUDE.md 원칙 — "원문은 지우지 않는다": 루브릭으로 변환한 뒤에도 원문 자체는 그대로 남겨둬야
    // 나중에 사장님이 규칙을 고치거나 루브릭을 다시 만들 때 원본을 참고할 수 있음.
    const storeRule = await prisma.storeRule.create({
      data: {
        storeId: store.id, // 이 규칙이 어느 매장 것인지 연결(외래키)
        ...(category !== undefined && { category }), // category가 있을 때만 포함
        ...(items !== undefined && { items }), // items가 있을 때만 포함 — 안 보내면 컬럼은 null로 남음
        rawText,
      },
    })

    // 3단계: 루브릭 생성엔 방금 저장한 이 제출 내용만 쓴다 — "지금까지 쌓인 규칙 전부"를 매번 다시
    // 합치면(예전엔 그렇게 했음) "기준 재설정"처럼 같은 화면을 여러 번 왕복할 때마다 이전 제출 내용까지
    // 겹쳐서 저장돼 규칙이 4개→8개→16개로 배로 불어나는 버그가 있었다. rawText 자체는 항상 그 시점의
    // "전체 규칙 목록"을 담아 제출되므로(RulesInput이 켜진 카드 전부를 합쳐서 보냄), 이번 제출 하나면 충분하다.
    // 과거 store_rules row들은 지우지 않고 그대로 남아있어(원문 보존 원칙) 나중에 감사/이력 확인엔 쓸 수 있다.
    const combinedRulesText = storeRule.rawText

    // 3-1단계: AI를 다시 부르기 전에, 재사용할 수 있는 배치가 있는지 먼저 확인한다(기능 강화①,
    // docs/rubric-reuse.md). 같은 업종의 다른 매장이 제출한 배치 중 "배치 안 모든 시나리오가 승인된
    // 루브릭을 가진" 것만 후보로 들어오고(findReuseCandidateBatches), 그중 이번 규칙 원문과 가장
    // 유사한 것 하나를 고른다(findBestReuseCandidate). 매칭되면 아래 4~5단계(AI 호출)를 완전히
    // 건너뛴다 — 이게 이 기능의 핵심(Gemini 호출 자체를 줄임).
    const reuseCandidates = await findReuseCandidateBatches({ industry: store.industry, excludeStoreId: store.id })
    const reuseMatch = findBestReuseCandidate(reuseCandidates, combinedRulesText)

    let rubricsWithScenario
    if (reuseMatch) {
      // 재사용 경로 — 매칭된 배치의 시나리오·루브릭을 그대로 복제한다. approvedAt은 여전히 null로
      // 시작한다(docs/rubric-reuse.md 결정) — 원본이 승인됐다고 복제본까지 자동 승인되지 않는다.
      rubricsWithScenario = await Promise.all(
        reuseMatch.scenarios.map(async (source, i) => {
          const scenario = await prisma.scenario.create({
            data: {
              storeId: store.id,
              storeRuleId: storeRule.id,
              type: `scenario-${i + 1}`,
              title: source.title,
              persona: source.persona,
              initialState: source.initialState,
            },
          })

          const rubric = await prisma.rubric.create({
            data: {
              scenarioId: scenario.id,
              criteria: source.criteria,
              version: 1,
              approvedAt: null,
            },
          })

          return {
            ...rubric,
            scenarioTitle: source.title,
            situation: source.persona?.situation,
            opening: source.persona?.opening,
          }
        })
      )
    } else {
      // 4단계: 예전엔 업종별로 고정된 시나리오 3개(지연/품절/규칙위반)에 규칙을 억지로 끼워맞췄지만,
      // 매장마다 규칙이 다르니 그 틀에 안 맞는 규칙(예: "테이크아웃 컵 리드 제공")은 훈련에 반영될 방법이
      // 없었다. 대신 방금 저장한 규칙 원문을 보고 AI가 실전 훈련용 상황(시나리오)을 직접 제안하게 한다.
      const proposedScenarios = await proposeScenarios({
        rawRulesText: combinedRulesText,
        industry: store.industry,
      })

      // 5단계: 제안된 상황마다 시나리오+루브릭을 항상 새로 만든다 — 기존처럼 같은 타입의 시나리오를
      // 재사용하지 않는다. "이번 제출로 만든 배치"와 "예전 배치"를 storeRuleId로 구분해야, 재설정을
      // 여러 번 해도 시나리오가 뒤섞이지 않고 "최신 배치"만 화면에 노출할 수 있다(설계 문서 3절).
      //
      // Promise.all(배열) — 배열 안의 여러 비동기 작업을 "동시에 전부 시작"시켜놓고, 그 작업들이 "다 끝날 때까지"만 기다림.
      // 제안된 상황들은 서로 결과를 참조하지 않는 독립적인 작업이라 병렬로 돌려도 안전함(rubric.js 호출이 시나리오당 20초 가까이 걸림).
      const rubrics = await Promise.all(
        proposedScenarios.map(async (proposed, i) => {
          // 5-1. 시나리오는 항상 새로 만든다. type엔 조회 키로서의 의미가 없어져서(4절 참고, 이제 조회는
          // scenario.id로 함) 그냥 순번만 채운다. persona에 AI가 제안한 situation/opening을 실제로 채워 쓴다
          // — 원래 "나중에 채울 자리"로 비어있던 컬럼이라 새 컬럼 추가 없이 이 자리를 채우는 것.
          const scenario = await prisma.scenario.create({
            data: {
              storeId: store.id,
              storeRuleId: storeRule.id,
              type: `scenario-${i + 1}`,
              title: proposed.title,
              persona: { situation: proposed.situation, opening: proposed.opening },
              initialState: {},
            },
          })

          // 5-2. 실제 LLM 호출 — server/src/lib/rubric.js의 generateRubric 함수는 그대로 재사용.
          const criteria = await generateRubric({
            scenarioType: scenario.type,
            scenarioTitle: proposed.title,
            situation: proposed.situation,
            rawRulesText: combinedRulesText,
          })

          // 5-3. 매번 새 Scenario라서(기존처럼 같은 시나리오를 재사용하지 않음) 버전 조회·bump 로직이
          // 필요 없어졌다 — 항상 1. approvedAt: null은 여전히 "AI가 막 만든 승인 전 초안" 상태를 의미.
          return prisma.rubric.create({
            data: {
              scenarioId: scenario.id,
              criteria,
              version: 1,
              approvedAt: null,
            },
          })
        })
      )
      // 프론트가 탭으로 구분해 보여줄 수 있게, 루브릭마다 시나리오 메타(제목·상황·오프닝)를 같이 붙여준다.
      rubricsWithScenario = rubrics.map((rubric, i) => ({
        ...rubric,
        scenarioTitle: proposedScenarios[i].title,
        situation: proposedScenarios[i].situation,
        opening: proposedScenarios[i].opening,
      }))
    }

    // 저장한 규칙 원문 + AI가 새로 제안한 시나리오 개수만큼의 루브릭을 한 번에 응답으로 돌려줌
    return res.status(201).json({ storeRule, rubrics: rubricsWithScenario })
  } catch (err) {
    // store 조회부터 루브릭 저장까지 이 try 블록 안 어디서든 에러가 나면 전부 여기로 옴
    console.error(err)
    return res.status(500).json({ error: 'failed to save rules and generate rubric' })
  }
})

// ============================================================
// 내 매장의 저장된 규칙 원문 조회 — GET /api/stores/me/rules (사장님 전용)
// "기준 재설정" 화면에서 그동안 입력한 규칙을 다시 불러와 수정할 수 있게 해준다.
// 가장 최근 제출(row) 하나만 돌려준다 — POST /:linkKey/rules도 루브릭을 만들 때 이제 최신 제출
// 하나만 쓰도록 바꿨으니(과거엔 전부 합쳐서 중복이 배로 쌓이는 버그가 있었다), "지금 루브릭이 실제로
// 근거하는 규칙"과 정확히 같은 내용을 보여주려면 여기도 최신 것 하나만 가져와야 한다.
// ============================================================
router.get('/me/rules', requireAuth, requireRole('owner'), async (req, res) => {
  if (!req.user.storeId) {
    return res.status(400).json({ error: 'no store linked to this account' })
  }

  try {
    const latest = await prisma.storeRule.findFirst({
      where: { storeId: req.user.storeId },
      orderBy: { createdAt: 'desc' },
    })
    // items가 없으면(items 컬럼 생기기 전에 저장된 과거 row) null — 프론트는 그때 raw_text를 파싱해서
    // SAVED 라벨로만 복원하는 예전 방식으로 폴백한다.
    return res.json({ rawText: latest?.rawText ?? '', items: latest?.items ?? null })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'failed to fetch rules' })
  }
})

// ============================================================
// 훈련 시작 가능한 시나리오 목록 — GET /api/stores/me/training-scenarios (사장님+알바 공용)
// ScenarioSelect.jsx가 이 API로 카드를 그린다. requireRole('owner')를 안 붙인 이유 — 알바도
// 훈련을 시작하려면 호출해야 하는 API라서, 로그인만 확인하고 역할은 안 가린다.
// "최신 배치"만 + "승인된 것"만 보여준다 — 재설정을 여러 번 한 매장이라도 예전 시나리오가 섞여
// 보이지 않고, 사장님이 아직 승인 안 한 초안은 알바 화면에 노출되지 않는다.
// ============================================================
router.get('/me/training-scenarios', requireAuth, async (req, res) => {
  if (!req.user.storeId) {
    return res.status(400).json({ error: 'no store linked to this account' })
  }

  try {
    const latestStoreRuleId = await getLatestStoreRuleId(req.user.storeId)

    const scenarios = await prisma.scenario.findMany({
      where: { storeId: req.user.storeId, storeRuleId: latestStoreRuleId, rubrics: { some: { approvedAt: { not: null } } } },
      orderBy: { createdAt: 'asc' },
    })

    return res.json({
      scenarios: scenarios.map((s) => ({ id: s.id, title: s.title, situation: s.persona?.situation ?? '' })),
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'failed to fetch training scenarios' })
  }
})

// ============================================================
// 내 매장의 루브릭 전체 조회 — GET /api/stores/me/rubrics (사장님 전용)
// 대시보드의 "기준 관리"에서 온보딩 이후에도 다시 들어와서 루브릭을 보고 고칠 수 있게 해준다.
// RulesInput→RubricApproval 흐름에서 쓰던 것과 같은 모양({..., scenarioType, scenarioTitle})으로 내려줘서
// 프론트가 RubricApproval 컴포넌트를 그대로 재사용할 수 있게 한다.
// "최신 배치"만 보여준다 — 안 그러면 재설정을 할 때마다 예전 시나리오의 루브릭 탭까지 계속 쌓여 보인다.
// ============================================================
router.get('/me/rubrics', requireAuth, requireRole('owner'), async (req, res) => {
  if (!req.user.storeId) {
    return res.status(400).json({ error: 'no store linked to this account' })
  }

  try {
    const latestStoreRuleId = await getLatestStoreRuleId(req.user.storeId)
    const scenarios = await prisma.scenario.findMany({
      where: { storeId: req.user.storeId, storeRuleId: latestStoreRuleId },
    })

    const rubrics = await Promise.all(
      scenarios.map(async (scenario) => {
        const latest = await prisma.rubric.findFirst({
          where: { scenarioId: scenario.id },
          orderBy: { version: 'desc' },
        })
        if (!latest) return null
        return {
          ...latest,
          scenarioType: scenario.type,
          scenarioTitle: scenario.title,
          situation: scenario.persona?.situation ?? '',
          opening: scenario.persona?.opening ?? '',
        }
      })
    )

    // 아직 루브릭이 없는 시나리오(이론상 규칙을 한 번도 안 저장한 매장)는 null이 섞이니 걸러낸다.
    return res.json({ rubrics: rubrics.filter(Boolean) })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'failed to fetch rubrics' })
  }
})

// ============================================================
// 알바별 진행 상황 집계 — GET /api/stores/me/staff-report (사장님 전용)
// 대시보드 통계·리포트 목록이 지금까지 mock 데이터였던 걸 실제 훈련 기록으로 교체한다.
//
// training_sessions에는 알바 계정을 가리키는 외래키가 없고 staff_label(자유 텍스트)만 있다 — 원래
// "로그인 없는 알바가 리포트에서 구분용으로 남기는 별칭" 용도였다(docs/checklist.md 설계). 지금은
// TrainingSession.jsx가 로그인한 알바의 user.name을 자동으로 staffLabel에 넣어주므로, 이름이 같으면
// 같은 사람이라고 보고 매칭한다 — 완벽한 방법은 아니지만(동명이인 시 섞일 수 있음) 지금 스키마로
// 가능한 최선이고, 정확한 방법은 나중에 training_sessions에 staff_id 외래키를 추가하는 것.
// ============================================================
router.get('/me/staff-report', requireAuth, requireRole('owner'), async (req, res) => {
  if (!req.user.storeId) {
    return res.status(400).json({ error: 'no store linked to this account' })
  }

  try {
    const latestStoreRuleId = await getLatestStoreRuleId(req.user.storeId)

    const [staffUsers, scenarios, sessions] = await Promise.all([
      prisma.user.findMany({ where: { storeId: req.user.storeId, role: 'staff' }, orderBy: { createdAt: 'asc' } }),
      // 최신 배치만 센다 — 안 그러면 재설정을 여러 번 한 매장은 예전 시나리오까지 다 더해져서
      // "진행률(N/M)"의 분모(M)가 재설정할 때마다 계속 불어난다.
      prisma.scenario.findMany({ where: { storeId: req.user.storeId, storeRuleId: latestStoreRuleId } }),
      prisma.trainingSession.findMany({
        where: { storeId: req.user.storeId },
        include: { scenario: true, sessionTurns: true },
      }),
    ])

    const totalScenarioTypes = scenarios.length
    // "이번 배치의 시나리오 중 몇 개를 완료했는지"를 셀 때, scenario.type(예: 'scenario-1')은 더 이상
    // 배치를 넘나드는 고유값이 아니다(매 배치가 1번부터 다시 시작) — scenario.id로 세야 다른 배치의
    // 같은 순번 시나리오를 완료한 걸 이번 배치 완료로 잘못 세지 않는다.
    const currentScenarioIds = new Set(scenarios.map((s) => s.id))

    // 이 매장 전체에서 "어떤 알바가 어떤 기준을 가장 자주 놓쳤는지" 모아서 코치 팁 하나를 뽑는다.
    const missByStaff = new Map() // staffLabel -> Map(criterionItem -> count)

    const staff = staffUsers.map((user) => {
      const mySessions = sessions.filter((s) => s.staffLabel === user.name)
      const completed = mySessions
        .filter((s) => s.status === 'completed')
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
      const completedTypes = new Set(completed.filter((s) => currentScenarioIds.has(s.scenarioId)).map((s) => s.scenarioId))

      for (const session of completed) {
        // 재입력(같은 turnNumber에 여러 시도)이 있으면 turnNumber당 최종 시도 하나만 센다 —
        // 안 그러면 재입력을 많이 한 턴 하나 때문에 "가장 자주 놓친 기준" 집계가 부풀려진다.
        for (const turn of pickFinalAttempts(session.sessionTurns)) {
          for (const item of turn.evaluation?.metItems ?? []) {
            if (item.met) continue
            if (!missByStaff.has(user.name)) missByStaff.set(user.name, new Map())
            const itemMap = missByStaff.get(user.name)
            itemMap.set(item.item, (itemMap.get(item.item) ?? 0) + 1)
          }
        }
      }

      // "최근 점수" = 가장 최근에 끝낸 세션의 하트 잔량 비율(남은 하트 / 총 하트). 훈련 화면에서
      // 알바가 보는 점수와 같은 기준이어야 목록·상세화면 점수가 서로 다르게 보이지 않는다 —
      // /me/staff/:id/latest-report도 정확히 같은 방식(computeHearts)으로 맞춘다.
      let score = null
      const latestSession = completed[0]
      if (latestSession) {
        const { maxHearts, heartsRemaining } = computeHearts(latestSession.sessionTurns)
        if (maxHearts > 0) {
          score = Math.round((heartsRemaining / maxHearts) * 100)
        }
      }

      const status =
        mySessions.length === 0
          ? 'pending'
          : totalScenarioTypes > 0 && completedTypes.size >= totalScenarioTypes
            ? 'done'
            : 'active'

      return {
        id: user.id,
        name: user.name,
        progress: totalScenarioTypes > 0 ? Math.round((completedTypes.size / totalScenarioTypes) * 100) : 0,
        done: `${completedTypes.size}/${totalScenarioTypes}`,
        score: score === null ? '—' : `${score}점`,
        status,
      }
    })

    const scored = staff.filter((s) => s.score !== '—')
    const avgScore =
      scored.length > 0
        ? Math.round(scored.reduce((sum, s) => sum + Number(s.score.replace('점', '')), 0) / scored.length)
        : null

    let coachTip = null
    let maxMiss = 0
    for (const [staffName, itemMap] of missByStaff) {
      for (const [item, count] of itemMap) {
        if (count > maxMiss) {
          maxMiss = count
          coachTip = { staffName, item }
        }
      }
    }

    return res.json({
      staff,
      stats: {
        totalStaff: staffUsers.length,
        avgScore,
        activeCount: staff.filter((s) => s.status === 'active').length,
        pendingCount: staff.filter((s) => s.status === 'pending').length,
      },
      coachTip,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'failed to build staff report' })
  }
})

// ============================================================
// 특정 알바의 가장 최근 리포트 — GET /api/stores/me/staff/:staffId/latest-report (사장님 전용)
// 리포트 목록에서 알바 행을 클릭했을 때 실제 최근 완료 세션의 체크리스트를 보여준다.
// ============================================================
router.get('/me/staff/:staffId/latest-report', requireAuth, requireRole('owner'), async (req, res) => {
  if (!req.user.storeId) {
    return res.status(400).json({ error: 'no store linked to this account' })
  }

  try {
    const staffUser = await prisma.user.findUnique({ where: { id: req.params.staffId } })
    if (!staffUser || staffUser.storeId !== req.user.storeId || staffUser.role !== 'staff') {
      return res.status(404).json({ error: 'staff not found' })
    }

    const session = await prisma.trainingSession.findFirst({
      where: { storeId: req.user.storeId, staffLabel: staffUser.name, status: 'completed' },
      orderBy: { completedAt: 'desc' },
      include: { scenario: true, sessionTurns: { orderBy: [{ turnNumber: 'asc' }, { retryCount: 'asc' }] } },
    })
    if (!session) {
      return res.status(404).json({ error: 'this staff has no completed training yet' })
    }

    // 체크리스트는 "지금 승인돼있는 최신 루브릭"이 아니라, 그 세션 turn마다 실제로 채점됐던
    // 기준(evaluation.metItems)에서 그대로 뽑는다. "기준 재설정"으로 루브릭 문구가 그 뒤에 바뀌면
    // 지금 루브릭과 그때 평가 기록의 item 문구가 안 맞아서 전부 미충족으로 잘못 보일 수 있다 —
    // 리포트는 항상 "그 순간 실제로 무엇을 기준으로 채점됐는지"를 보여줘야 한다.
    // 여러 턴에 걸쳐 한 번이라도 충족했으면 그 기준은 "충족"으로 본다 — 실시간 훈련 화면
    // (TrainingSession.jsx)이 체크리스트를 누적해서 보여주는 것과 같은 규칙.
    const allLabels = new Set()
    const metLabels = new Set()
    for (const turn of pickFinalAttempts(session.sessionTurns)) {
      for (const item of turn.evaluation?.metItems ?? []) {
        allLabels.add(item.item)
        if (item.met) metLabels.add(item.item)
      }
    }

    const checklist = [...allLabels].map((label) => ({
      label,
      status: metLabels.has(label) ? 'ok' : 'wait',
    }))

    // 점수는 목록(/me/staff-report)과 같은 기준(하트 잔량 비율)으로 맞춘다 — computeHearts에 넘기는
    // sessionTurns가 같으니 자동으로 목록 점수와 일치한다.
    const { maxHearts, heartsRemaining } = computeHearts(session.sessionTurns)

    // "총 훈련 시간"·업종 태그도 예전엔 고정 문구("18분", "카페 · 디저트 기준")였던 걸 실제 값으로 채운다.
    const durationMinutes = session.completedAt
      ? Math.max(1, Math.round((session.completedAt - session.startedAt) / 60000))
      : null
    const store = await prisma.store.findUnique({ where: { id: req.user.storeId } })

    return res.json({
      checklist,
      scenarioTitle: session.scenario.title,
      staffName: staffUser.name,
      durationMinutes,
      industry: store?.industry ?? null,
      heartsRemaining,
      maxHearts,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'failed to fetch staff report' })
  }
})

// ============================================================
// 알바 계정 생성 — POST /api/stores/me/staff (사장님 전용)
// 알바는 셀프 회원가입이 없고, 로그인한 사장님이 이메일+초기 비밀번호를 정해서 계정을 만들어준다.
// req.user.storeId는 토큰 안 값 — 매장을 만든 뒤 재로그인/재발급된 토큰이어야 정확하다(POST / 응답의 새 token 참고).
// ============================================================
router.post('/me/staff', requireAuth, requireRole('owner'), async (req, res) => {
  const { email, password, name } = req.body ?? {}

  if (!req.user.storeId) {
    return res.status(400).json({ error: 'create a store before adding staff' })
  }
  if (typeof email !== 'string' || email.trim().length === 0 || email.length > 255) {
    return res.status(400).json({ error: 'email is required' })
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' })
  }
  if (name !== undefined && (typeof name !== 'string' || name.length > 50)) {
    return res.status(400).json({ error: 'name must be a string of 50 characters or fewer' })
  }

  try {
    const passwordHash = await hashPassword(password)
    const staff = await prisma.user.create({
      data: {
        email: email.trim(),
        passwordHash,
        role: 'staff',
        storeId: req.user.storeId,
        ...(name !== undefined && { name }),
      },
    })
    return res.status(201).json({ id: staff.id, email: staff.email, name: staff.name })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ error: 'email already in use' })
    }
    console.error(err)
    return res.status(500).json({ error: 'failed to create staff account' })
  }
})

export default router
