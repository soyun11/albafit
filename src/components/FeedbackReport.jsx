import { useState } from 'react'
import './FeedbackReport.css'
import mascotApprove from '../../img/mascot-approve.png'
import mascotConfused from '../../img/mascot-confused.png'
import mascotCoach from '../../img/mascot-coach.png'
import { INDUSTRIES } from '../lib/industries'

// 실제 훈련 세션 없이 대시보드에서 과거 리포트를 볼 때 쓰는 기본 mock 데이터
const DEFAULT_ITEMS = [
  {
    label: '인사말',
    status: 'ok',
    detail: '첫 인사와 마무리 인사 모두 매장 기준 그대로 사용했어요.',
  },
  {
    label: '컴플레인 대응',
    status: 'wait',
    detail: '거절 표현 앞에 공감 문구가 빠졌어요.',
    quote: '"개봉 상품은 교환만 가능한 점 참고 부탁드려요!"',
    suggestion:
      '→ "불편 드려 죄송해요, 다만 개봉 상품은 교환으로 도와드리고 있어요"처럼 공감을 먼저 넣어보세요.',
  },
  {
    label: '커스텀 음료 요청',
    status: 'ok',
    detail: '추가 비용 안내를 결제 전에 정확히 전달했어요.',
  },
]

function buildItemsFromChecklist(checklist) {
  return checklist.map((item) => ({
    label: item.label,
    status: item.status === 'ok' ? 'ok' : 'wait',
    detail:
      item.status === 'ok'
        ? '이번 상황에서 매장 기준대로 잘 응대했어요.'
        : '이 기준은 아직 답변에서 확인되지 않았어요. 다음 훈련에서 다시 연습해보세요.',
  }))
}

function FeedbackReport({
  onHome,
  onRetry,
  checklist,
  scenarioTag,
  durationMinutes,
  industry,
  heartsRemaining,
  maxHearts,
  staffName = '나',
  onCalibrate,
}) {
  const [shared, setShared] = useState(false)

  const items = checklist ? buildItemsFromChecklist(checklist) : DEFAULT_ITEMS
  const passedCount = items.filter((item) => item.status === 'ok').length
  // 점수는 훈련 중 남은 하트 비율로 매긴다(기준을 하나도 못 채운 답변에서만 하트가 깎이는 방식) —
  // 하트 정보가 없는 경우(과거 데이터 등)에는 기준 충족 비율로 대신 계산한다.
  const score =
    maxHearts > 0 ? Math.round((heartsRemaining / maxHearts) * 100) : Math.round((passedCount / items.length) * 100)
  const industryLabel = INDUSTRIES.find((i) => i.key === industry)?.label ?? '카페 · 디저트'
  const summaryLine = scenarioTag
    ? `${industryLabel} 기준 · ${scenarioTag} 시나리오 완료`
    : `${industryLabel} 기준 8개 상황 완료`

  function handleShare() {
    setShared(true)
    setTimeout(() => setShared(false), 1500)
  }

  return (
    <div className="report-page">
      <nav className="report-nav">
        <button type="button" className="logo-word mono" onClick={onHome}>
          albafit
        </button>
        <button type="button" className="nav-link" onClick={onHome}>
          홈으로 돌아가기
        </button>
      </nav>

      <div className="report-wrap">
        <div className="summary-card glass">
          <img src={mascotApprove} alt="" />
          <div className="summary-text">
            <div className="eyebrow mono">훈련 결과 · {staffName}</div>
            <h1>오늘 훈련, 잘하셨어요</h1>
            <p>{summaryLine}</p>
          </div>
          <div className="score-badge">
            <b>{score}점</b>
            <span>기준 부합도</span>
          </div>
        </div>

        <div className="metric-row">
          <div className="metric glass">
            <b>
              {passedCount}/{items.length}
            </b>
            <span>기준 충족 상황</span>
          </div>
          <div className="metric glass">
            <b>{maxHearts > 0 ? maxHearts - heartsRemaining : items.length - passedCount}건</b>
            <span>교정 피드백</span>
          </div>
          <div className="metric glass">
            <b>{durationMinutes != null ? `${durationMinutes}분` : '—'}</b>
            <span>총 훈련 시간</span>
          </div>
        </div>

        <div className="section-label">상황별 상세 피드백</div>

        {items.map((item) => (
          <div key={item.label} className="rule-report glass">
            <div className="rr-top">
              <img src={item.status === 'ok' ? mascotApprove : mascotConfused} alt="" />
              <span className="rr-title">{item.label}</span>
              <span className={`rr-result ${item.status === 'ok' ? 'good' : 'improve'}`}>
                {item.status === 'ok' ? '잘함' : '개선 필요'}
              </span>
            </div>
            <div className="rr-detail">{item.detail}</div>
            {item.quote && <div className="rr-quote">{item.quote}</div>}
            {item.suggestion && <div className="rr-detail">{item.suggestion}</div>}
          </div>
        ))}

        <div className="coach-note glass">
          <img src={mascotCoach} alt="" />
          <div>
            <h4>AI 트레이너 코멘트</h4>
            <p>
              {passedCount === items.length
                ? '모든 기준을 다 충족했어요. 이 페이스를 유지해보세요!'
                : '전체적으로 안정적이에요. 개선 필요 항목만 습관을 들이면 다음엔 만점에 가까울 거예요.'}
            </p>
          </div>
        </div>

        <div className="actions">
          <button type="button" className="btn-ghost" onClick={onRetry}>
            다시 훈련하기
          </button>
          {onCalibrate ? (
            <button type="button" className="btn-primary" onClick={onCalibrate}>
              AI 채점 검토하기
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={handleShare}>
              {shared ? '공유됐어요!' : '리포트 사장님께 공유'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default FeedbackReport
