import { useEffect, useState } from 'react'
import './TrainingSession.css'
import { apiFetch } from '../lib/api'
import AppNav from './AppNav'

import mascotGreeting from '../../img/mascot-greeting.png'
import mascotCoach from '../../img/mascot-coach.png'
import mascotApprove from '../../img/mascot-approve.png'
import mascotConfused from '../../img/mascot-confused.png'

const MAX_TURNS = 3
const DEFAULT_HINT = '체크리스트 항목을 모두 확인했어요. 마무리 인사를 건네보세요.'

function TrainingSession({ onNavigate, onChangePassword, onLogout, onFinish, scenario = 'delay', staffLabel }) {
  const [loading, setLoading] = useState(true)
  const [startError, setStartError] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [scenarioTitle, setScenarioTitle] = useState('')
  const [criteria, setCriteria] = useState([])
  const [messages, setMessages] = useState([])
  const [currentCustomerMessage, setCurrentCustomerMessage] = useState('')
  const [checklist, setChecklist] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [turnIndex, setTurnIndex] = useState(0)
  const [feedback, setFeedback] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [durationMinutes, setDurationMinutes] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function start() {
      setLoading(true)
      setStartError('')
      try {
        const data = await apiFetch('/api/sessions', {
          method: 'POST',
          body: { scenarioType: scenario, staffLabel },
        })
        if (cancelled) return

        setSessionId(data.session.id)
        setScenarioTitle(data.scenario.title)
        setCriteria(data.rubric.criteria)
        setChecklist(
          data.rubric.criteria.map((c, i) => ({ id: i, label: c.item, status: 'wait', required: c.required }))
        )
        setMessages([{ sender: 'customer', text: data.openingLine }])
        setCurrentCustomerMessage(data.openingLine)
      } catch (err) {
        if (!cancelled) setStartError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    start()
    return () => {
      cancelled = true
    }
  }, [scenario, staffLabel])

  const passedCount = checklist.filter((item) => item.status === 'ok').length
  const nextWaitItem = checklist.find((item) => item.status === 'wait')
  const nextWaitCriterion = nextWaitItem ? criteria[nextWaitItem.id] : null
  const hint = nextWaitCriterion ? nextWaitCriterion.good_example : DEFAULT_HINT

  async function handleSubmit(event) {
    event.preventDefault()
    const trimmed = inputValue.trim()
    if (!trimmed || submitting || completed) return

    setMessages((prev) => [...prev, { sender: 'staff', text: trimmed }])
    setInputValue('')
    setSubmitting(true)

    try {
      const data = await apiFetch(`/api/sessions/${sessionId}/turns`, {
        method: 'POST',
        body: { customerMessage: currentCustomerMessage, staffAnswer: trimmed },
      })

      const metItemLabels = new Set(data.evaluation.metItems.filter((m) => m.met).map((m) => m.item))
      setChecklist((prev) =>
        prev.map((item) => (metItemLabels.has(item.label) ? { ...item, status: 'ok' } : item))
      )

      setFeedback({
        type: data.evaluation.passed ? 'approve' : 'confused',
        text: data.evaluation.feedback,
      })

      if (data.completed) {
        setCompleted(true)
        setDurationMinutes(data.durationMinutes)
      } else {
        setTurnIndex((prev) => prev + 1)
        setTimeout(() => {
          setMessages((prev) => [...prev, { sender: 'customer', text: data.nextCustomerMessage }])
        }, 600)
        setCurrentCustomerMessage(data.nextCustomerMessage)
      }
    } catch (err) {
      setFeedback({ type: 'confused', text: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  function handleEndTraining() {
    onFinish?.(checklist, scenarioTitle, durationMinutes)
  }

  if (loading) {
    return (
      <div className="session-page">
        <div className="session-wrap">
          <p>손님을 준비하고 있어요...</p>
        </div>
      </div>
    )
  }

  if (startError) {
    return (
      <div className="session-page">
        <div className="session-wrap">
          <p>훈련을 시작하지 못했어요: {startError}</p>
          <button type="button" className="btn-ghost" onClick={() => onNavigate('home')}>
            홈으로
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="session-page">
      <AppNav role="staff" current="training" onNavigate={onNavigate} onChangePassword={onChangePassword} onLogout={onLogout}>
        <button type="button" className="end-btn" onClick={handleEndTraining}>
          훈련 종료
        </button>
      </AppNav>

      <div className="session-wrap">
        <div className="greeting-banner glass">
          <img src={mascotGreeting} alt="마스코트" />
          <p>오늘은 {scenarioTitle} 상황을 연습해봐요.</p>
        </div>

        <div className="progress-row">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${(turnIndex / MAX_TURNS) * 100}%` }}></div>
          </div>
          <span className="progress-label">{turnIndex + 1} / {MAX_TURNS} 상황</span>
        </div>

        <div className="session-grid">
          <section className="chat-card glass">
            <span className="scenario-tag">시나리오 · {scenarioTitle}</span>

            {messages.map((message, index) => (
              <div key={index} className={`msg ${message.sender}`}>
                {message.text}
              </div>
            ))}

            {feedback && (
              <div className={`feedback-bubble ${feedback.type}`}>
                <img
                  src={
                    feedback.type === 'approve'
                      ? mascotApprove
                      : feedback.type === 'coach'
                      ? mascotCoach
                      : mascotConfused
                  }
                  alt="Feedback Mascot"
                />
                <p>{feedback.text}</p>
              </div>
            )}

            {completed ? (
              <p className="session-complete-note">훈련이 끝났어요! "훈련 종료"를 눌러 결과를 확인하세요.</p>
            ) : (
              <form className="input-bar" onSubmit={handleSubmit}>
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

          <aside className="side-col">
            <div className="mentor-card glass">
              <img src={mascotCoach} alt="Mentor Mascot" />
              <div className="hint-text">
                <h4>AI 트레이너 힌트</h4>
                <p>{hint}</p>
              </div>
            </div>

            <div className="rule-check-list glass">
              {checklist.map((item) => (
                <div key={item.id} className="rc-item">
                  <div className={`rc-dot ${item.status}`} />
                  {item.label}
                </div>
              ))}
            </div>

            <div className="metric-mini glass">
              <div className="metric-item">
                <span className="metric-label">기준 충족</span>
                <span className="metric-value">{passedCount} / {checklist.length}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

export default TrainingSession
