import { useState } from 'react'
import './ScenarioSelect.css'
import mascotGreeting from '../../img/mascot-greeting.png'

const SCENARIOS = [
  { key: 'delay', icon: '⏰', title: '음료 지연', desc: '사과 · 대기시간 안내 연습' },
  { key: 'outOfStock', icon: '📦', title: '품절 메뉴', desc: '사과 · 대체 메뉴 안내 연습' },
  { key: 'ruleViolation', icon: '🙅', title: '매장 규칙 위반 손님', desc: '규칙 안내 · 부드러운 대안 제시 연습' },
]

function ScenarioSelect({ onHome, onNext }) {
  const [selected, setSelected] = useState('delay')

  return (
    <div className="scenario-page">
      <nav className="scenario-nav">
        <button type="button" className="logo-word mono" onClick={onHome}>
          albafit
        </button>
        <span className="scenario-nav-step mono">시나리오 선택</span>
      </nav>

      <div className="scenario-wrap">
        <img className="mascot-hero" src={mascotGreeting} alt="" />
        <div className="eyebrow mono">훈련 시작 · 시나리오 선택</div>
        <h1>오늘은 어떤 상황을 연습할까요?</h1>
        <p className="sub">카페에서 자주 나오는 상황 3가지 중 하나를 골라 훈련을 시작해보세요.</p>

        <div className="scenario-grid">
          {SCENARIOS.map((scenario) => {
            const isSelected = selected === scenario.key

            return (
              <button
                key={scenario.key}
                type="button"
                className={`scenario-card glass ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelected(scenario.key)}
              >
                <span className="scenario-icon">{scenario.icon}</span>
                <span className="scenario-title">{scenario.title}</span>
                <span className="scenario-desc">{scenario.desc}</span>
                <div className="check" />
              </button>
            )
          })}
        </div>

        <div className="footer-bar">
          <div className="footer-actions">
            <button type="button" className="btn-primary" onClick={() => onNext(selected)}>
              시작하기 →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ScenarioSelect
