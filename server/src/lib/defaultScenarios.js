import prisma from './prisma.js'

// 업종별 기본 매뉴얼 — 매장 생성 즉시 알바가 훈련할 수 있게 미리 채워둔 정적 데이터.
// docs/default-manual-scenarios.md 결정: AI 호출 없이 사람이 미리 채운다(매장 생성 응답 속도·
// Gemini 일일 호출 한도에 영향 없게). situation/opening은 원래 industryScenarios.js·customerAgent.js의
// SCENARIOS 맵(guest 전용)에 있던 문장을 재사용해서 썼다 — 그 두 곳은 이후 guest-tour-redesign.md에서
// 체험하기를 정적 투어로 바꾸며 삭제됐고, 이 파일의 criteria가 src/lib/guestTourContent.js로도 옮겨져
// 쓰인다. 6개 업종(IndustrySelect.jsx 기준) 전부 채웠다 — 이 객체에 없는 업종은
// buildDefaultSeedData가 빈 배열을 반환해 기존 콜드스타트 그대로 유지된다(의도된 graceful fallback).
const DEFAULT_SCENARIOS = {
  cafe: [
    {
      title: '음료 지연',
      situation: '카페에서 음료를 주문하고 오래 기다리고 있는 상황',
      opening: '저기요, 주문한 지 15분 넘었는데 아직 안 나왔어요. 얼마나 더 기다려야 하나요?',
      criteria: [
        {
          item: '불편을 드린 점에 대해 먼저 사과한다',
          required: true,
          good_example: '기다리시게 해서 죄송해요, 바로 확인해드릴게요',
          bad_example: '원래 시간 좀 걸려요',
        },
        {
          item: '예상 대기 시간이나 진행 상황을 구체적으로 안내한다',
          required: true,
          good_example: '지금 확인해보니 2분 안에 나올 것 같아요',
          bad_example: '조금만 기다리세요',
        },
        {
          item: '많이 늦어질 경우 대안을 제시한다',
          required: false,
          good_example: '많이 늦어지면 다른 음료로 먼저 준비해드릴 수도 있어요',
          bad_example: '대안 언급 없이 기다리라고만 함',
        },
      ],
    },
    {
      title: '품절 메뉴',
      situation: '주문하려는 메뉴의 재료가 품절이라는 안내를 받는 상황',
      opening: '아이스 카라멜 마키아토 하나 주세요.',
      criteria: [
        {
          item: '품절 사실을 정중하고 명확하게 안내한다',
          required: true,
          good_example: '죄송해요, 지금 그 메뉴 재료가 다 떨어졌어요',
          bad_example: '그거 없어요',
        },
        {
          item: '대체 가능한 메뉴를 먼저 제안한다',
          required: true,
          good_example: '혹시 카페라떼는 어떠세요? 맛이 비슷해요',
          bad_example: '다른 거 시키세요',
        },
        {
          item: '고객이 대체를 원하지 않으면 강요하지 않는다',
          required: false,
          good_example: '괜찮아요, 다른 걸로 천천히 골라보세요',
          bad_example: '계속 특정 메뉴를 권유함',
        },
      ],
    },
    {
      title: '커스텀 음료 요청',
      situation: '손님이 시럽 추가·얼음량 조절 같은 음료 커스텀을 요청하는 상황',
      opening: '혹시 시럽 추가하고 얼음 적게 넣어줄 수 있어요?',
      criteria: [
        {
          item: '가능 여부를 먼저 명확히 답한다',
          required: true,
          good_example: '네 가능해요',
          bad_example: '바로 답 안 하고 다른 얘기부터 함',
        },
        {
          item: '추가 비용이 있으면 결제 전에 안내한다',
          required: true,
          good_example: '시럽 추가는 500원 추가돼요, 괜찮으세요?',
          bad_example: '결제 후에야 추가금 얘기함',
        },
        {
          item: '요청 내용을 다시 확인해 실수를 방지한다',
          required: false,
          good_example: '시럽 추가, 얼음 적게, 맞으시죠?',
          bad_example: '확인 없이 바로 제조',
        },
      ],
    },
  ],
  convenience: [
    {
      title: '품절 상품',
      situation: '편의점에서 사려는 상품이 품절인 상황',
      opening: '혹시 삼각김밥 있어요?',
      criteria: [
        {
          item: '품절 사실을 정중하게 안내한다',
          required: true,
          good_example: '죄송해요, 지금 그 상품은 다 나갔어요',
          bad_example: '없어요',
        },
        {
          item: '비슷한 대체 상품이 있으면 안내한다',
          required: true,
          good_example: '비슷한 걸로 다른 브랜드 삼각김밥은 있어요',
          bad_example: '대체 안내 없이 그냥 없다고만 함',
        },
        {
          item: '재입고 시점을 알 수 있으면 안내한다',
          required: false,
          good_example: '오후에 다시 들어올 예정이에요',
          bad_example: '재입고 여부 언급 없음',
        },
      ],
    },
    {
      title: '미성년자 확인',
      situation: '나이 확인이 필요한 상품(담배·주류)을 사려는 상황',
      opening: '여기 담배 한 갑 주세요.',
      criteria: [
        {
          item: '신분증 확인을 요청한다',
          required: true,
          good_example: '신분증 확인 부탁드릴게요',
          bad_example: '확인 없이 바로 판매',
        },
        {
          item: '미성년자로 확인되면 정중하게 판매를 거절한다',
          required: true,
          good_example: '죄송하지만 미성년자분께는 판매가 어려워요',
          bad_example: '화내거나 무시하고 판매',
        },
        {
          item: '거절 이유(법적 규정)를 간단히 설명한다',
          required: false,
          good_example: '법으로 정해진 부분이라 저희도 어쩔 수 없어요',
          bad_example: '이유 설명 없이 그냥 안 된다고만 함',
        },
      ],
    },
    {
      title: '결제·포인트 실수',
      situation: '결제나 포인트 적립에 문제가 생긴 상황',
      opening: '저 포인트 적립 안 해주셨는데요?',
      criteria: [
        {
          item: '불편을 드린 점에 대해 사과한다',
          required: true,
          good_example: '불편 드려 죄송해요',
          bad_example: '사과 없이 바로 확인만 함',
        },
        {
          item: '문제 상황을 확인하고 정정 절차를 안내한다',
          required: true,
          good_example: '결제 내역 확인해서 포인트 다시 적립해드릴게요',
          bad_example: '저희 잘못 아니에요',
        },
        {
          item: '처리 완료 후 확인해준다',
          required: false,
          good_example: '지금 포인트 다시 넣어드렸어요, 확인해보세요',
          bad_example: '처리했는지 안내 없이 끝냄',
        },
      ],
    },
  ],
  restaurant: [
    {
      title: '웨이팅 안내',
      situation: '음식점에 왔는데 자리가 없어 대기해야 하는 상황',
      opening: '지금 들어가면 얼마나 기다려야 해요?',
      criteria: [
        {
          item: '대기해야 하는 상황을 정중히 안내한다',
          required: true,
          good_example: '지금은 자리가 다 차서 잠시 기다려주셔야 해요',
          bad_example: '자리 없어요',
        },
        {
          item: '예상 대기시간을 구체적으로 안내한다',
          required: true,
          good_example: '10분 정도면 자리 날 것 같아요',
          bad_example: '글쎄요, 기다려보세요',
        },
        {
          item: '대기 중 앉을 곳이나 대기 방법을 안내한다',
          required: false,
          good_example: '저쪽 의자에서 기다리시면 순서되면 불러드릴게요',
          bad_example: '대기 방법 안내 없음',
        },
      ],
    },
    {
      title: '재료 소진',
      situation: '주문하려는 메뉴의 재료가 다 떨어진 상황',
      opening: '여기 오늘의 메뉴 하나 주세요.',
      criteria: [
        {
          item: '재료 소진 사실을 정중히 안내한다',
          required: true,
          good_example: '죄송해요, 그 메뉴는 재료가 다 떨어졌어요',
          bad_example: '그거 안 돼요',
        },
        {
          item: '대체 메뉴를 제안한다',
          required: true,
          good_example: '혹시 다른 메뉴는 어떠세요? 이것도 맛있어요',
          bad_example: '대체 제안 없이 다른 거 고르라고만 함',
        },
        {
          item: '재료 소진 이유를 간단히 설명한다',
          required: false,
          good_example: '오늘 재료가 예상보다 빨리 나갔어요',
          bad_example: '이유 설명 없음',
        },
      ],
    },
    {
      title: '맛·이물질 컴플레인',
      situation: '음식 맛이나 이물질 관련 컴플레인을 하는 상황',
      opening: '저기요, 이 음식에 이상한 게 들어있는데요?',
      criteria: [
        {
          item: '먼저 정중히 사과하고 공감한다',
          required: true,
          good_example: '불편 드려 정말 죄송해요',
          bad_example: '사과 없이 바로 원인부터 물음',
        },
        {
          item: '확인 절차(재조리·환불 등)를 안내한다',
          required: true,
          good_example: '바로 확인해서 다시 만들어드리거나 환불해드릴게요',
          bad_example: '저희는 그런 적 없는데요',
        },
        {
          item: '매니저 확인이 필요하면 안내한다',
          required: false,
          good_example: '정확한 처리를 위해 매니저님께 바로 확인해드릴게요',
          bad_example: '확인 없이 알아서 처리',
        },
      ],
    },
  ],
  mart: [
    {
      title: '가격표 오류',
      situation: '진열된 가격표와 실제 계산 금액이 다른 상황',
      opening: '여기 가격표엔 3000원이라고 써있는데 계산하니 5000원이 나왔어요.',
      criteria: [
        {
          item: '불편에 대해 사과한다',
          required: true,
          good_example: '혼란 드려 죄송해요',
          bad_example: '가격표가 잘못됐나 보네요(책임 회피)',
        },
        {
          item: '가격을 다시 확인하고 정정 절차를 안내한다',
          required: true,
          good_example: '바로 확인해볼게요, 가격표 기준으로 처리해드릴게요',
          bad_example: '이미 계산됐으니 어쩔 수 없어요',
        },
        {
          item: '가격표 오류 원인을 확인 후 안내한다',
          required: false,
          good_example: '가격표 교체가 안 돼있었나 봐요, 바로 수정할게요',
          bad_example: '원인 언급 없이 끝냄',
        },
      ],
    },
    {
      title: '상품 위치 문의',
      situation: '찾는 상품이 어디 있는지 몰라 묻는 상황',
      opening: '저기 혹시 세제는 어디 있어요?',
      criteria: [
        {
          item: '상품 위치를 명확히 안내한다',
          required: true,
          good_example: '세제는 3번 코너 오른쪽에 있어요',
          bad_example: '저쪽에 있어요(모호)',
        },
        {
          item: '친절한 태도로 응대한다',
          required: true,
          good_example: '제가 안내해드릴게요, 이쪽으로 오세요',
          bad_example: '귀찮은 티를 내며 대충 손짓만 함',
        },
        {
          item: '직접 안내(동행)를 제안한다',
          required: false,
          good_example: '같이 가서 보여드릴게요',
          bad_example: '위치만 말하고 끝냄',
        },
      ],
    },
    {
      title: '반품·교환',
      situation: '구매한 상품을 반품하거나 교환하려는 상황',
      opening: '이거 어제 샀는데 환불 되나요?',
      criteria: [
        {
          item: '반품·교환 가능 여부를 확인한다',
          required: true,
          good_example: '영수증 있으시면 확인해드릴게요',
          bad_example: '확인 없이 바로 안 된다고 함',
        },
        {
          item: '절차를 정확히 안내한다',
          required: true,
          good_example: '영수증이랑 상품 주시면 환불 도와드릴게요',
          bad_example: '절차 설명 없이 알아서 하라고 함',
        },
        {
          item: '불가능한 경우 이유를 정중히 설명한다',
          required: false,
          good_example: '사용 흔적이 있어서 반품이 어려워요, 양해 부탁드려요',
          bad_example: '이유 없이 그냥 안 된다고만 함',
        },
      ],
    },
  ],
  pcroom: [
    {
      title: '좌석 이용시간',
      situation: '좌석·부스 이용 가능 시간을 문의하는 상황',
      opening: '저 여기 몇 시간까지 쓸 수 있어요?',
      criteria: [
        {
          item: '이용 가능 시간을 정확히 안내한다',
          required: true,
          good_example: '지금 결제하신 시간 기준으로 새벽 2시까지 이용 가능해요',
          bad_example: '글쎄요, 확인해보세요',
        },
        {
          item: '친절하게 응대한다',
          required: true,
          good_example: '편하게 이용하시고 시간 다 되면 안내해드릴게요',
          bad_example: '무뚝뚝하게 시간만 말함',
        },
        {
          item: '연장 방법을 안내한다',
          required: false,
          good_example: '더 쓰시려면 카운터에서 연장하시면 돼요',
          bad_example: '연장 방법 언급 없음',
        },
      ],
    },
    {
      title: '장비 문제',
      situation: 'PC나 장비에 문제가 생겨 도움을 요청하는 상황',
      opening: '여기 마우스가 잘 안 눌리는데요.',
      criteria: [
        {
          item: '불편에 대해 사과한다',
          required: true,
          good_example: '불편드려 죄송해요, 바로 확인해드릴게요',
          bad_example: '사과 없이 그래요? 라고만 함',
        },
        {
          item: '즉시 확인하거나 조치한다',
          required: true,
          good_example: '마우스 바로 새 걸로 바꿔드릴게요',
          bad_example: '조금 있다 봐드릴게요(방치)',
        },
        {
          item: '자리를 옮겨주는 등 대안을 제시한다',
          required: false,
          good_example: '옆자리로 옮겨드릴까요?',
          bad_example: '대안 제시 없음',
        },
      ],
    },
    {
      title: '요금 계산 문의',
      situation: '이용 요금 계산이 맞는지 의문을 제기하는 상황',
      opening: '제가 두 시간만 썼는데 왜 세 시간 요금이 나왔어요?',
      criteria: [
        {
          item: '요금 내역을 다시 확인한다',
          required: true,
          good_example: '잠시만요, 이용 시간 다시 확인해볼게요',
          bad_example: '확인 없이 맞게 나온 거라고만 함',
        },
        {
          item: '확인 결과를 명확히 설명한다',
          required: true,
          good_example: '확인해보니 30분 추가 이용하신 게 포함됐어요',
          bad_example: '설명 없이 그냥 맞다고만 함',
        },
        {
          item: '착오가 있었으면 정정해준다',
          required: false,
          good_example: '확인해보니 저희 착오였어요, 바로 정정해드릴게요',
          bad_example: '착오가 있어도 정정 안 함',
        },
      ],
    },
  ],
  beauty: [
    {
      title: '예약 지연',
      situation: '예약한 시간보다 시술이 늦어지는 상황',
      opening: '저 3시에 예약했는데 왜 아직도 기다려야 해요?',
      criteria: [
        {
          item: '지연에 대해 먼저 사과한다',
          required: true,
          good_example: '많이 기다리게 해드려 죄송해요',
          bad_example: '사과 없이 조금만 기다리세요라고만 함',
        },
        {
          item: '예상 대기시간을 구체적으로 안내한다',
          required: true,
          good_example: '5분 안에 준비해드릴 수 있을 것 같아요',
          bad_example: '곧 될 거예요(모호)',
        },
        {
          item: '대기 중 편의를 제공한다',
          required: false,
          good_example: '차 한 잔 드릴까요?',
          bad_example: '아무 배려 없이 대기시킴',
        },
      ],
    },
    {
      title: '시술 변경 요청',
      situation: '예약한 시술 내용을 바꾸고 싶어하는 상황',
      opening: '생각해보니까 커트 말고 펌으로 하고 싶은데 가능해요?',
      criteria: [
        {
          item: '변경 가능 여부를 확인한다',
          required: true,
          good_example: '지금 일정 확인해볼게요',
          bad_example: '확인 없이 바로 안 된다고 함',
        },
        {
          item: '가능하면 변경된 시술로 명확히 안내한다',
          required: true,
          good_example: '네 가능해요, 펌으로 진행해드릴게요',
          bad_example: '애매하게 넘어감',
        },
        {
          item: '가격·시간 차이를 미리 안내한다',
          required: false,
          good_example: '펌은 시간이 좀 더 걸리고 가격도 달라요, 안내해드릴게요',
          bad_example: '가격·시간 차이 안내 없이 진행',
        },
      ],
    },
    {
      title: '가격 안내 미흡',
      situation: '시술 가격 안내가 미리 충분히 안 된 상황',
      opening: '이거 얼마 나와요? 처음에 말한 가격이랑 다른 것 같은데요.',
      criteria: [
        {
          item: '불편에 대해 사과한다',
          required: true,
          good_example: '가격 안내가 부족했네요, 죄송해요',
          bad_example: '원래 그런 가격이에요(방어적)',
        },
        {
          item: '정확한 가격을 다시 안내한다',
          required: true,
          good_example: '지금 확인해보니 총 5만원이에요, 항목별로 설명드릴게요',
          bad_example: '정확한 안내 없이 넘어감',
        },
        {
          item: '다음부터는 미리 안내하겠다고 안심시킨다',
          required: false,
          good_example: '다음엔 시작 전에 꼭 먼저 안내드릴게요',
          bad_example: '재발 방지 언급 없음',
        },
      ],
    },
  ],
}

/**
 * 업종별 기본 시나리오+루브릭을 매장 생성 시점에 바로 DB에 쓸 수 있는 모양으로 변환한다.
 * storeRuleId를 null로 둬서 "최신 배치만 노출" 필터(storeRuleId === latestStoreRuleId)가
 * 자동 통과되게 하고, approvedAt을 now로 채워 처음부터 "승인됨" 상태로 시작하게 한다
 * (docs/default-manual-scenarios.md 결정).
 * @param {string} industry
 * @param {Date} now
 * @returns {Array<{ scenario: object, rubric: object }>}
 */
export function buildDefaultSeedData(industry, now = new Date()) {
  const scenarios = DEFAULT_SCENARIOS[industry] ?? []

  return scenarios.map(({ title, situation, opening, criteria }, i) => ({
    scenario: {
      type: `scenario-${i + 1}`,
      title,
      persona: { situation, opening },
      initialState: {},
      storeRuleId: null,
    },
    rubric: {
      criteria,
      version: 1,
      approvedAt: now,
    },
  }))
}

/**
 * 매장 생성 직후 기본 시나리오+루브릭을 실제로 DB에 심는다. 절대 throw하지 않는다 — 이 함수의
 * 실패가 매장 생성 자체를 실패로 보이게 만들면 안 되기 때문(docs/default-manual-scenarios.md).
 * 실패하면 그 시점까지 만든 것만 남고 멈추며, 그 매장은 기존처럼 콜드스타트 상태로 남는다.
 * @param {{ storeId: string, industry: string }} params
 */
export async function seedDefaultScenarios({ storeId, industry }) {
  try {
    const seedData = buildDefaultSeedData(industry)
    for (const { scenario, rubric } of seedData) {
      const createdScenario = await prisma.scenario.create({
        data: { storeId, ...scenario },
      })
      await prisma.rubric.create({
        data: { scenarioId: createdScenario.id, ...rubric },
      })
    }
  } catch (err) {
    console.error('default manual seeding failed', err)
  }
}
