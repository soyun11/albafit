import { useEffect, useState } from 'react'
import './TurnCalibrationReview.css'
import AppNav from './AppNav'
import mascotCoach from '../../img/mascot-coach.png'
import mascotApprove from '../../img/mascot-approve.png'
import mascotConfused from '../../img/mascot-confused.png'
import { apiFetch } from '../lib/api'

// 사장님이 evaluation.ownerCorrection을 아직 안 남겼으면 원본 Gemini met 값을, 이미 남겼으면
// 그 교정값을 화면 기본값으로 보여준다 — 새로고침해도 마지막으로 저장한 교정이 그대로 보여야 한다.
function buildInitialMet(turn) {
  const correctedByItem = new Map((turn.ownerCorrection?.correctedItems ?? []).map((c) => [c.item, c.met]))
  const met = {}
  for (const { item, met: originalMet } of turn.metItems) {
    met[item] = correctedByItem.has(item) ? correctedByItem.get(item) : originalMet
  }
  return met
}

function TurnCalibrationReview({ sessionId, staffName, onBack, onNavigate, onChangePassword, onLogout }) {
  const [turns, setTurns] = useState(null)
  const [scenarioTitle, setScenarioTitle] = useState('')
  const [error, setError] = useState('')
  const [metByTurn, setMetByTurn] = useState({})
  const [commentByTurn, setCommentByTurn] = useState({})
  const [savingTurnId, setSavingTurnId] = useState(null)
  const [savedTurnId, setSavedTurnId] = useState(null)

  useEffect(() => {
    if (!sessionId) return
    apiFetch(`/api/sessions/${sessionId}`)
      .then((data) => {
        setTurns(data.turns)
        setScenarioTitle(data.scenario?.title ?? '')
        setMetByTurn(Object.fromEntries(data.turns.map((t) => [t.turnId, buildInitialMet(t)])))
        setCommentByTurn(Object.fromEntries(data.turns.map((t) => [t.turnId, t.ownerCorrection?.comment ?? ''])))
      })
      .catch((err) => setError(err.message))
  }, [sessionId])

  function toggleMet(turnId, item) {
    setMetByTurn((prev) => ({ ...prev, [turnId]: { ...prev[turnId], [item]: !prev[turnId][item] } }))
    setSavedTurnId(null)
  }

  function setComment(turnId, value) {
    setCommentByTurn((prev) => ({ ...prev, [turnId]: value }))
    setSavedTurnId(null)
  }

  async function saveCorrection(turn) {
    setError('')
    setSavingTurnId(turn.turnId)
    try {
      const correctedItems = turn.metItems.map(({ item }) => ({ item, met: metByTurn[turn.turnId][item] }))
      const updated = await apiFetch(`/api/sessions/turns/${turn.turnId}/calibration`, {
        method: 'PATCH',
        body: { correctedItems, comment: commentByTurn[turn.turnId] },
      })
      setTurns((prev) => prev.map((t) => (t.turnId === turn.turnId ? { ...t, ownerCorrection: updated.evaluation.ownerCorrection } : t)))
      setSavedTurnId(turn.turnId)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingTurnId(null)
    }
  }

  return (
    <div className="calibration-page">
      <AppNav role="owner" current="reports" onNavigate={onNavigate} onChangePassword={onChangePassword} onLogout={onLogout} />

      <div className="calibration-wrap">
        <div className="calibration-head">
          <img className="mascot-hero" src={mascotCoach} alt="" />
          <div className="eyebrow mono">평가 캘리브레이션 · {staffName}</div>
          <h1>AI 채점이 맞았는지 확인해보세요</h1>
          <p className="sub">
            {scenarioTitle ? `${scenarioTitle} 시나리오의 턴별 채점이에요. ` : ''}
            AI가 잘못 채점했다고 생각되면 항목을 눌러 바꾸고, 이유를 코멘트로 남겨보세요. 원래 AI 채점 기록은 그대로 남아요.
          </p>
          <button type="button" className="btn-ghost" onClick={onBack}>
            ← 리포트로
          </button>
        </div>

        {error && <p className="calibration-error">{error}</p>}

        {turns === null && !error && <p className="sub">불러오는 중...</p>}

        {turns?.map((turn) => {
          const met = metByTurn[turn.turnId] ?? {}
          const hasChanges = turn.metItems.some(({ item, met: originalMet }) => met[item] !== originalMet)
          const comment = commentByTurn[turn.turnId] ?? ''

          return (
            <div key={turn.turnId} className="turn-card glass">
              <div className="turn-top">
                <span className="turn-label mono">
                  TURN {turn.turnNumber}
                  {turn.retryCount > 0 ? ` · 재시도 ${turn.retryCount}` : ''}
                </span>
                {turn.ownerCorrection && <span className="corrected-badge">사장님 교정 있음</span>}
              </div>

              <div className="turn-dialogue">
                <p>
                  <strong>손님</strong> · {turn.customerMessage}
                </p>
                <p>
                  <strong>알바</strong> · {turn.staffAnswer}
                </p>
              </div>

              <div className="turn-items">
                {turn.metItems.map(({ item }) => {
                  const isMet = met[item]
                  return (
                    <button
                      key={item}
                      type="button"
                      className={`met-toggle ${isMet ? 'ok' : 'wait'}`}
                      onClick={() => toggleMet(turn.turnId, item)}
                    >
                      <img src={isMet ? mascotApprove : mascotConfused} alt="" />
                      {item} · {isMet ? '충족' : '미충족'}
                    </button>
                  )
                })}
              </div>

              <div className="turn-ai-note">
                <strong>AI 피드백</strong> · {turn.feedback}
              </div>

              <textarea
                className="correction-comment"
                placeholder="이 채점을 왜 고쳤는지 메모해두면 나중에 루브릭·프롬프트를 다듬을 때 도움이 돼요."
                value={comment}
                onChange={(event) => setComment(turn.turnId, event.target.value)}
              />

              <div className="turn-actions">
                {savedTurnId === turn.turnId && <span className="saved-note">저장됐어요</span>}
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => saveCorrection(turn)}
                  disabled={savingTurnId === turn.turnId || (!hasChanges && !comment)}
                >
                  {savingTurnId === turn.turnId ? '저장 중...' : '교정 저장'}
                </button>
              </div>
            </div>
          )
        })}

        {turns?.length === 0 && <p className="sub">이 세션엔 아직 턴 기록이 없어요.</p>}
      </div>
    </div>
  )
}

export default TurnCalibrationReview
