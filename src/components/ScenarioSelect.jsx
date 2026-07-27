import { useEffect, useState } from 'react'
import './ScenarioSelect.css'
import mascotGreeting from '../../img/mascot-greeting.png'
import { apiFetch } from '../lib/api'
import AppNav from './AppNav'

function ScenarioSelect({ onNext, onNavigate, onChangePassword, onLogout }) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [scenarios, setScenarios] = useState([])
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setLoadError('')
      try {
        const data = await apiFetch('/api/stores/me/training-scenarios')
        if (cancelled) return
        setScenarios(data.scenarios)
        setSelected(data.scenarios[0]?.id ?? null)
      } catch (err) {
        if (!cancelled) setLoadError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="scenario-page">
      <AppNav role="staff" current="scenario" onNavigate={onNavigate} onChangePassword={onChangePassword} onLogout={onLogout} />

      <div className="scenario-wrap">
        <img className="mascot-hero" src={mascotGreeting} alt="" />
        <div className="eyebrow mono">훈련 시작 · 시나리오 선택</div>
        <h1>오늘은 어떤 상황을 연습할까요?</h1>
        <p className="sub">우리 매장 기준으로 만들어진 상황 중 하나를 골라 훈련을 시작해보세요.</p>

        {loading && <p className="sub">시나리오를 불러오는 중이에요...</p>}
        {!loading && loadError && <p className="sub">시나리오를 불러오지 못했어요: {loadError}</p>}
        {!loading && !loadError && scenarios.length === 0 && (
          <p className="sub">아직 승인된 시나리오가 없어요. 사장님께 기준 승인을 요청해주세요.</p>
        )}

        {!loading && !loadError && scenarios.length > 0 && (
          <div className="scenario-grid">
            {scenarios.map((scenario) => {
              const isSelected = selected === scenario.id

              return (
                <button
                  key={scenario.id}
                  type="button"
                  className={`scenario-card glass ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelected(scenario.id)}
                >
                  <span className="scenario-title">
                    {scenario.title}
                    {scenario.isDefault && <span className="scenario-badge-default">기본</span>}
                  </span>
                  <span className="scenario-desc">{scenario.situation}</span>
                  <div className="check" />
                </button>
              )
            })}
          </div>
        )}

        <div className="footer-bar">
          <div className="footer-actions">
            <button type="button" className="btn-primary" disabled={!selected} onClick={() => onNext(selected)}>
              시작하기 →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ScenarioSelect
