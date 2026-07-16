import { useEffect, useState } from 'react'
import './TrainingSession.css'
import { apiFetch } from '../lib/api'
import AppNav from './AppNav'

import mascotGreeting from '../../img/mascot-greeting.png'
import mascotCoach from '../../img/mascot-coach.png'
import mascotApprove from '../../img/mascot-approve.png'
import mascotConfused from '../../img/mascot-confused.png'

const DEFAULT_HINT = '체크리스트 항목을 모두 확인했어요. 마무리 인사를 건네보세요.'
// 서버(sessions.js)의 HEARTS_PER_CRITERION과 같은 값 — 서버 응답이 오기 전(훈련 시작 직후) 하트를
// 몇 개로 그려야 할지 미리 계산하는 용도로만 쓴다. 실제 하트 잔량은 항상 서버 응답값을 따른다.
const HEARTS_PER_CRITERION = 2

function TrainingSession({ onNavigate, onChangePassword, onLogout, onFinish, scenario, staffLabel }) {
  const [loading, setLoading] = useState(true)
  const [startError, setStartError] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [scenarioTitle, setScenarioTitle] = useState('')
  const [criteria, setCriteria] = useState([])
  const [messages, setMessages] = useState([])
  const [currentCustomerMessage, setCurrentCustomerMessage] = useState('')
  const [checklist, setChecklist] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  // celebrating: 훈련이 끝나서(기준 다 충족 or 3턴 소진) 결과 화면으로 넘어가기 직전, 축하 배너를
  // 잠깐 보여주는 상태. 이 상태가 되면 더 이상 입력을 못 받고, 잠시 후 자동으로 리포트로 이동한다.
  const [celebrating, setCelebrating] = useState(false)
  const [allCriteriaMet, setAllCriteriaMet] = useState(false)
  const [heartsExhausted, setHeartsExhausted] = useState(false)
  const [durationMinutes, setDurationMinutes] = useState(null)
  const [maxHearts, setMaxHearts] = useState(0)
  const [heartsRemaining, setHeartsRemaining] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function start() {
      setLoading(true)
      setStartError('')
      try {
        const data = await apiFetch('/api/sessions', {
          method: 'POST',
          body: { scenarioId: scenario, staffLabel },
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
        // 첫 응답이 오기 전까지 보여줄 기본 하트 개수 — 실제 값은 첫 제출 후 서버 응답으로 갱신된다.
        const startingHearts = data.rubric.criteria.length * HEARTS_PER_CRITERION
        setMaxHearts(startingHearts)
        setHeartsRemaining(startingHearts)
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
    if (!trimmed || submitting || celebrating) return

    setMessages((prev) => [...prev, { sender: 'staff', text: trimmed }])
    setInputValue('')
    setSubmitting(true)

    try {
      const data = await apiFetch(`/api/sessions/${sessionId}/turns`, {
        method: 'POST',
        body: { customerMessage: currentCustomerMessage, staffAnswer: trimmed },
      })

      const metItemLabels = new Set(data.evaluation.metItems.filter((m) => m.met).map((m) => m.item))
      // setChecklist(prev => ...) 대신 값을 직접 계산해둔다 — 아래에서 훈련이 끝났을 때 onFinish로
      // 넘길 최신 체크리스트가 필요한데, setChecklist는 비동기라 여기서 곧장 최신값을 못 읽는다.
      const updatedChecklist = checklist.map((item) =>
        metItemLabels.has(item.label) ? { ...item, status: 'ok' } : item
      )
      setChecklist(updatedChecklist)
      setMaxHearts(data.maxHearts)
      setHeartsRemaining(data.heartsRemaining)

      if (data.heartsExhausted) {
        // 하트를 다 썼다 — 이번 답을 통과했는지와 무관하게 여기서 바로 끝난다.
        setFeedback({ type: 'confused', text: data.evaluation.feedback })
        setHeartsExhausted(true)
        setAllCriteriaMet(false)
        setDurationMinutes(data.durationMinutes)
        setCelebrating(true)
      } else if (data.retryNeeded) {
        // 같은 손님 질문에 다시 답할 차례 — turnIndex/currentCustomerMessage를 그대로 둬서 다음 제출도
        // 같은 질문에 대한 재입력으로 서버에 전달되게 한다. 입력창은 celebrating이 false라 자동으로 유지된다.
        setFeedback({
          type: 'confused',
          text: `${data.evaluation.feedback} 다시 답해볼까요?`,
        })
      } else {
        setFeedback({
          type: data.evaluation.passed ? 'approve' : 'confused',
          text: data.evaluation.feedback,
        })

        if (data.completed) {
          // 기준을 다 채웠으면(또는 3턴을 다 썼으면) 남은 상황을 억지로 더 진행하지 않고 바로 끝낸다.
          // 축하 배너를 보여주고, 사용자가 "결과 확인하기" 버튼을 눌러야 리포트 화면으로 넘어간다.
          setAllCriteriaMet(data.allCriteriaMet)
          setDurationMinutes(data.durationMinutes)
          setCelebrating(true)
        } else {
          setTimeout(() => {
            setMessages((prev) => [...prev, { sender: 'customer', text: data.nextCustomerMessage }])
          }, 600)
          setCurrentCustomerMessage(data.nextCustomerMessage)
        }
      }
    } catch (err) {
      setFeedback({ type: 'confused', text: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  // 훈련 중단 — 언제든 누르면 지금까지의 체크리스트 상태 그대로 결과 화면으로 나간다("종료"가
  // 아니라 도중에 그만두는 것이라 이름을 구분했다). 자동 완료 흐름과는 별개의 탈출구다.
  function handleAbortTraining() {
    onFinish?.(checklist, scenarioTitle, durationMinutes, heartsRemaining, maxHearts)
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
        <button type="button" className="end-btn" onClick={handleAbortTraining}>
          훈련 중단
        </button>
      </AppNav>

      <div className="session-wrap">
        <div className="greeting-banner glass">
          <img src={mascotGreeting} alt="마스코트" />
          <p>오늘은 {scenarioTitle} 상황을 연습해봐요.</p>
        </div>

        <div className="progress-row">
          <span className="progress-label">기준 충족 {passedCount} / {checklist.length}</span>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${checklist.length ? (passedCount / checklist.length) * 100 : 0}%` }}
            ></div>
          </div>
        </div>

        <div className="hearts-block">
          <div className="hearts-row" aria-label={`남은 하트 ${heartsRemaining} / ${maxHearts}`}>
            {Array.from({ length: maxHearts }, (_, i) => (
              <span key={i} className={`heart ${i < heartsRemaining ? 'full' : 'empty'}`}>
                {i < heartsRemaining ? '♥' : '♡'}
              </span>
            ))}
          </div>
          <p className="hearts-hint">
            기준을 하나도 못 채운 답변에서만 하트가 줄어요. 하트가 다 떨어지면 훈련이 바로 끝나요.
          </p>
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

            {celebrating ? (
              <div className="session-celebrate">
                <img
                  src={heartsExhausted ? mascotConfused : mascotApprove}
                  alt="완료"
                  className="celebrate-mascot"
                />
                <p className="celebrate-title">
                  {heartsExhausted
                    ? '하트를 모두 써서 훈련이 끝났어요'
                    : allCriteriaMet
                      ? '모든 기준을 완료했어요!'
                      : '훈련이 끝났어요!'}
                </p>
                <p className="celebrate-sub">아래 버튼을 눌러 결과를 확인하세요.</p>
                <button
                  type="button"
                  className="btn-primary celebrate-cta"
                  onClick={() => onFinish?.(checklist, scenarioTitle, durationMinutes, heartsRemaining, maxHearts)}
                >
                  결과 화면으로 넘어가기
                </button>
              </div>
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
