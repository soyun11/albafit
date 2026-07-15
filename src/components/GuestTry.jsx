import { useState } from 'react'
import './GuestTry.css'
import AppNav from './AppNav'
import mascotGreeting from '../../img/mascot-greeting.png'
import mascotCoach from '../../img/mascot-coach.png'
import mascotApprove from '../../img/mascot-approve.png'
import mascotConfused from '../../img/mascot-confused.png'
import { INDUSTRIES, INDUSTRY_SCENARIOS } from '../lib/industries'
import { apiFetch } from '../lib/api'

const MAX_TURNS = 3
const RULES_PLACEHOLDER = '예: 미성년자에게 술·담배 판매 금지, 신분증 꼭 확인해요. 품절 상품은 재입고 시점을 안내해요.'

// 로그인·매장 연결 없이 규칙→루브릭 변환과 손님과의 대화를 실제로 체험해보는 화면.
// 전부 이 컴포넌트의 로컬 state로만 굴러가고 서버에 아무것도 저장하지 않는다 — 새로고침하면 사라짐.
function GuestTry({ onNavigate }) {
  const [step, setStep] = useState('industry') // industry | scenario | rules | rubric | chat
  const [industry, setIndustry] = useState(null)
  const [scenarioType, setScenarioType] = useState(null)
  const [scenarioTitle, setScenarioTitle] = useState('')
  const [rawRulesText, setRawRulesText] = useState('')
  const [criteria, setCriteria] = useState([])
  const [checklist, setChecklist] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [turnIndex, setTurnIndex] = useState(0)
  const [feedback, setFeedback] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [completed, setCompleted] = useState(false)

  function pickIndustry(key) {
    setIndustry(key)
    setStep('scenario')
  }

  function pickScenario(scenario) {
    setScenarioType(scenario.key)
    setScenarioTitle(scenario.title)
    setStep('rules')
  }

  async function handleGenerateRubric(event) {
    event.preventDefault()
    if (!rawRulesText.trim()) {
      setError('규칙을 한 줄이라도 적어주세요.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const data = await apiFetch('/api/guest/rubric', {
        method: 'POST',
        auth: false,
        body: { scenarioType, rawRulesText: rawRulesText.trim() },
      })
      setCriteria(data.criteria)
      setChecklist(data.criteria.map((c, i) => ({ id: i, label: c.item, status: 'wait' })))
      setStep('rubric')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function startChat() {
    setError('')
    setLoading(true)
    try {
      const data = await apiFetch(`/api/guest/opening?scenarioType=${scenarioType}`, { auth: false })
      setMessages([{ sender: 'customer', text: data.openingLine }])
      setStep('chat')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const trimmed = inputValue.trim()
    if (!trimmed || submitting || completed) return

    const historySoFar = messages
    setMessages((prev) => [...prev, { sender: 'staff', text: trimmed }])
    setInputValue('')
    setSubmitting(true)

    try {
      const data = await apiFetch('/api/guest/turn', {
        method: 'POST',
        auth: false,
        body: { scenarioType, criteria, messages: historySoFar, staffAnswer: trimmed },
      })

      const metItemLabels = new Set(data.evaluation.metItems.filter((m) => m.met).map((m) => m.item))
      setChecklist((prev) =>
        prev.map((item) => (metItemLabels.has(item.label) ? { ...item, status: 'ok' } : item))
      )
      setFeedback({ type: data.evaluation.passed ? 'approve' : 'confused', text: data.evaluation.feedback })

      if (data.completed) {
        setCompleted(true)
      } else {
        setTurnIndex((prev) => prev + 1)
        setTimeout(() => {
          setMessages((prev) => [...prev, { sender: 'customer', text: data.nextCustomerMessage }])
        }, 600)
      }
    } catch (err) {
      setFeedback({ type: 'confused', text: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  const scenarios = INDUSTRY_SCENARIOS[industry] ?? []
  const passedCount = checklist.filter((item) => item.status === 'ok').length
  const nextWaitItem = checklist.find((item) => item.status === 'wait')
  const hint = nextWaitItem ? criteria[nextWaitItem.id]?.good_example : '체크리스트를 다 채웠어요!'

  return (
    <div className="guest-page">
      <AppNav role="guest" onNavigate={onNavigate} />

      <div className="guest-wrap">
        <div className="guest-mode-banner mono">비회원 체험 모드 · 대화 내용은 저장되지 않아요</div>

        {step === 'industry' && (
          <>
            <img className="mascot-hero" src={mascotGreeting} alt="" />
            <div className="eyebrow mono">체험하기 · 1/4</div>
            <h1>어떤 업종을 체험해볼까요?</h1>
            <div className="guest-grid">
              {INDUSTRIES.map((ind) => (
                <button key={ind.key} type="button" className="guest-card glass" onClick={() => pickIndustry(ind.key)}>
                  <span className="guest-card-icon">{ind.icon}</span>
                  <span className="guest-card-title">{ind.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'scenario' && (
          <>
            <img className="mascot-hero" src={mascotGreeting} alt="" />
            <div className="eyebrow mono">체험하기 · 2/4</div>
            <h1>어떤 상황을 연습해볼까요?</h1>
            <div className="guest-grid">
              {scenarios.map((scenario) => (
                <button
                  key={scenario.key}
                  type="button"
                  className="guest-card glass"
                  onClick={() => pickScenario(scenario)}
                >
                  <span className="guest-card-icon">{scenario.icon}</span>
                  <span className="guest-card-title">{scenario.title}</span>
                  <span className="guest-card-desc">{scenario.desc}</span>
                </button>
              ))}
            </div>
            <button type="button" className="btn-ghost" onClick={() => setStep('industry')}>
              ← 업종 다시 고르기
            </button>
          </>
        )}

        {step === 'rules' && (
          <>
            <img className="mascot-hero" src={mascotCoach} alt="" />
            <div className="eyebrow mono">체험하기 · 3/4 · {scenarioTitle}</div>
            <h1>이 상황에 적용할 규칙을 적어보세요</h1>
            <p className="guest-sub">
              실제 매장 규정이 아니어도 괜찮아요 — 자유롭게 적어보시면 AI가 진짜 채점 기준으로 바꿔드려요.
            </p>
            <form className="guest-card glass guest-form" onSubmit={handleGenerateRubric}>
              <textarea
                className="guest-textarea"
                value={rawRulesText}
                onChange={(event) => setRawRulesText(event.target.value)}
                placeholder={RULES_PLACEHOLDER}
                rows={5}
              />
              {error && <p className="guest-error">{error}</p>}
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'AI가 채점 기준 만드는 중...' : '채점 기준 만들기 →'}
              </button>
            </form>
            <button type="button" className="btn-ghost" onClick={() => setStep('scenario')}>
              ← 시나리오 다시 고르기
            </button>
          </>
        )}

        {step === 'rubric' && (
          <>
            <img className="mascot-hero" src={mascotApprove} alt="" />
            <div className="eyebrow mono">체험하기 · 4/4 · {scenarioTitle}</div>
            <h1>AI가 만든 채점 기준이에요</h1>
            {criteria.map((c, i) => (
              <div key={i} className="guest-criterion glass">
                <div className="guest-criterion-top">
                  <span className="guest-criterion-title">{c.item}</span>
                  <span className={`guest-req-badge ${c.required ? '' : 'optional'}`}>
                    {c.required ? '필수' : '선택'}
                  </span>
                </div>
                <div className="guest-example good">✓ {c.good_example}</div>
                <div className="guest-example bad">✗ {c.bad_example}</div>
              </div>
            ))}
            {error && <p className="guest-error">{error}</p>}
            <button type="button" className="btn-primary" onClick={startChat} disabled={loading}>
              {loading ? '손님 준비 중...' : '이 기준으로 대화 체험하기 →'}
            </button>
          </>
        )}

        {step === 'chat' && (
          <div className="guest-session">
            <div className="guest-progress-row">
              <div className="guest-progress-track">
                <div className="guest-progress-fill" style={{ width: `${(turnIndex / MAX_TURNS) * 100}%` }} />
              </div>
              <span className="guest-progress-label">{turnIndex + 1} / {MAX_TURNS} 상황</span>
            </div>

            <div className="guest-session-grid">
              <section className="guest-chat-card glass">
                <span className="guest-scenario-tag">{scenarioTitle}</span>

                {messages.map((message, index) => (
                  <div key={index} className={`guest-msg ${message.sender}`}>
                    {message.text}
                  </div>
                ))}

                {feedback && (
                  <div className={`guest-feedback-bubble ${feedback.type}`}>
                    <img src={feedback.type === 'approve' ? mascotApprove : mascotConfused} alt="" />
                    <p>{feedback.text}</p>
                  </div>
                )}

                {completed ? (
                  <div className="guest-done-card">
                    <img src={mascotApprove} alt="" />
                    <h3>체험 끝! 어떠셨어요?</h3>
                    <p>실제 매장으로 등록하면, 우리 매장 진짜 규칙으로 알바를 훈련시킬 수 있어요.</p>
                    <button type="button" className="btn-primary" onClick={() => onNavigate('signup')}>
                      무료로 시작하기 →
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => onNavigate('home')}>
                      홈으로
                    </button>
                  </div>
                ) : (
                  <form className="guest-input-bar" onSubmit={handleSubmit}>
                    <input
                      value={inputValue}
                      onChange={(event) => setInputValue(event.target.value)}
                      placeholder="답변을 입력하세요..."
                      disabled={submitting}
                    />
                    <button type="submit" disabled={submitting}>
                      {submitting ? '채점 중...' : '보내기'}
                    </button>
                  </form>
                )}
              </section>

              <aside className="guest-side-col">
                <div className="guest-hint-card glass">
                  <img src={mascotCoach} alt="" />
                  <div>
                    <h4>AI 트레이너 힌트</h4>
                    <p>{hint}</p>
                  </div>
                </div>
                <div className="guest-checklist glass">
                  {checklist.map((item) => (
                    <div key={item.id} className="guest-checklist-item">
                      <div className={`guest-dot ${item.status}`} />
                      {item.label}
                    </div>
                  ))}
                </div>
                <div className="guest-metric glass">
                  <span>기준 충족</span>
                  <b>{passedCount} / {checklist.length}</b>
                </div>
              </aside>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default GuestTry
