import { useState } from 'react'
import './IndustrySelect.css'
import StepSidebar from './StepSidebar'
import mascotGreeting from '../../img/mascot-greeting.png'
import mascotCoach from '../../img/mascot-coach.png'

const INDUSTRIES = [
  { key: 'cafe', icon: '☕', label: '카페 · 디저트' },
  { key: 'convenience', icon: '🏪', label: '편의점' },
  { key: 'restaurant', icon: '🍽️', label: '음식점 · 외식' },
  { key: 'mart', icon: '🛒', label: '마트 · 유통' },
  { key: 'pcroom', icon: '🎮', label: 'PC방 · 오락실' },
  { key: 'beauty', icon: '💇', label: '뷰티 · 헤어' },
]

const HINTS = {
  cafe: '카페를 선택하면 커스텀 음료·포장·매장 이용 관련 응대 예시가 다음 화면에 먼저 채워져요.',
}
const DEFAULT_HINT = '이 업종은 아직 준비된 예시가 없어요. 카페 예시를 참고해서 직접 입력해주세요.'

function IndustrySelect({ onHome, onBack, onNext }) {
  const [selectedIndustry, setSelectedIndustry] = useState('cafe')
  const [manualText, setManualText] = useState('')

  const hint = HINTS[selectedIndustry] ?? DEFAULT_HINT

  function handleNext() {
    onNext(manualText)
  }

  return (
    <div className="industry-page">
      <nav className="industry-nav">
        <button type="button" className="logo-word mono" onClick={onHome}>
          albafit
        </button>
        <span className="industry-nav-step mono">STEP 1 / 3</span>
      </nav>

      <StepSidebar current={1} />

      <div className="industry-wrap">
        <img className="mascot-hero" src={mascotGreeting} alt="" />
        <div className="eyebrow mono">매장업종선택 · 매뉴얼입력</div>
        <h1>어떤 업종이신가요?</h1>
        <p className="sub">
          업종에 맞는 응대 예시를 먼저 보여드리고, 그 예시를 바탕으로 매장 기준을 다음 화면에서
          확정하실 수 있어요.
        </p>

        <div className="industry-grid">
          {INDUSTRIES.map((industry) => {
            const isSelected = selectedIndustry === industry.key

            return (
              <button
                key={industry.key}
                type="button"
                className={`industry-card glass ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedIndustry(industry.key)}
              >
                <span className="industry-icon">{industry.icon}</span>
                <span className="industry-label">{industry.label}</span>
                <div className="check" />
              </button>
            )
          })}
        </div>

        <div className="hint glass">
          <img src={mascotCoach} alt="" />
          <span>{hint}</span>
        </div>

        <div className="manual-card glass">
          <div className="manual-label mono">+ 매장 매뉴얼 · 규정 입력 (선택)</div>
          <textarea
            className="manual-input"
            value={manualText}
            onChange={(event) => setManualText(event.target.value)}
            placeholder="예: 저희 매장은 포장 손님에게 빨대를 요청 시에만 드려요. 마감 30분 전에는 신메뉴 주문을 받지 않아요."
          />
          <button type="button" className="btn-ghost photo-upload-btn">
            📷 사진으로 업로드 (준비 중)
          </button>
          <p className="manual-note">
            여기에 적은 내용을 AI가 읽고, 다음 화면(규칙확인)에 초안 카드로 만들어드려요.
          </p>
        </div>

        <div className="footer-bar">
          <div className="footer-actions">
            <button type="button" className="btn-ghost" onClick={onBack}>
              ← 이전
            </button>
            <button type="button" className="btn-primary" onClick={handleNext}>
              다음 →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default IndustrySelect
