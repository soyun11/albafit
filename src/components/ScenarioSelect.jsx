import { useState } from 'react'
import './ScenarioSelect.css'
import mascotGreeting from '../../img/mascot-greeting.png'
import { INDUSTRY_SCENARIOS } from '../lib/industries'
import AppNav from './AppNav'

function ScenarioSelect({ onNext, onNavigate, onChangePassword, onLogout, industry }) {
  const scenarios = INDUSTRY_SCENARIOS[industry] ?? INDUSTRY_SCENARIOS.cafe
  const [selected, setSelected] = useState(scenarios[0].key)

  return (
    <div className="scenario-page">
      <AppNav role="staff" current="scenario" onNavigate={onNavigate} onChangePassword={onChangePassword} onLogout={onLogout} />

      <div className="scenario-wrap">
        <img className="mascot-hero" src={mascotGreeting} alt="" />
        <div className="eyebrow mono">훈련 시작 · 시나리오 선택</div>
        <h1>오늘은 어떤 상황을 연습할까요?</h1>
        <p className="sub">우리 매장에서 자주 나오는 상황 3가지 중 하나를 골라 훈련을 시작해보세요.</p>

        <div className="scenario-grid">
          {scenarios.map((scenario) => {
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
