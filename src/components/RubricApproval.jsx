import { useState } from 'react'
import './RubricApproval.css'
import StepSidebar from './StepSidebar'
import mascotCoach from '../../img/mascot-coach.png'
import mascotApprove from '../../img/mascot-approve.png'
import AppNav from './AppNav'
import { apiFetch } from '../lib/api'

function RubricApproval({
  onHome,
  onBack,
  onInvite,
  onDone,
  onNavigate,
  onChangePassword,
  onLogout,
  onStepClick,
  onResetRules,
  showSteps,
  rubrics,
  onRubricsChange,
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [approvingId, setApprovingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingIndex, setEditingIndex] = useState(null)
  const [draftGood, setDraftGood] = useState('')
  const [draftBad, setDraftBad] = useState('')

  if (!rubrics || rubrics.length === 0) {
    return (
      <div className="rubric-page">
        <AppNav
          role="owner"
          current={onDone ? 'rubricManage' : 'rubric'}
          onNavigate={onNavigate}
          onChangePassword={onChangePassword}
          onLogout={onLogout}
        >
          {onDone && (
            <button type="button" className="btn-primary-sm" onClick={onResetRules}>
              기준 재설정
            </button>
          )}
        </AppNav>
        {(!onDone || showSteps) && <StepSidebar current={3} onStepClick={onDone ? onStepClick : undefined} />}
        <div className="rubric-wrap">
          <p className="sub">아직 만들어진 루브릭이 없어요.</p>
          <button type="button" className="btn-ghost" onClick={onBack}>
            ← 이전으로
          </button>
        </div>
      </div>
    )
  }

  const active = rubrics[activeIndex]
  const allApproved = rubrics.every((r) => r.approvedAt)

  // 이 시나리오의 criteria 배열 전체를 서버에 저장. 내용이 바뀌었으니 서버가 approvedAt을 null로 되돌려준다.
  async function persistCriteria(newCriteria) {
    setError('')
    setSaving(true)
    try {
      const updated = await apiFetch(`/api/rubrics/${active.id}`, {
        method: 'PATCH',
        body: { criteria: newCriteria },
      })
      onRubricsChange(
        rubrics.map((r) => (r.id === active.id ? { ...r, criteria: updated.criteria, approvedAt: updated.approvedAt } : r))
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function toggleRequired(index) {
    const next = active.criteria.map((c, i) => (i === index ? { ...c, required: !c.required } : c))
    persistCriteria(next)
  }

  function startEdit(index, criterion) {
    setEditingIndex(index)
    setDraftGood(criterion.good_example)
    setDraftBad(criterion.bad_example)
  }

  function cancelEdit() {
    setEditingIndex(null)
  }

  async function saveEdit(index) {
    const good = draftGood.trim()
    const bad = draftBad.trim()
    if (!good || !bad) return

    const next = active.criteria.map((c, i) => (i === index ? { ...c, good_example: good, bad_example: bad } : c))
    await persistCriteria(next)
    setEditingIndex(null)
  }

  async function handleApprove(rubric) {
    setError('')
    setApprovingId(rubric.id)
    try {
      const updated = await apiFetch(`/api/rubrics/${rubric.id}/approve`, { method: 'PATCH' })
      onRubricsChange(rubrics.map((r) => (r.id === rubric.id ? { ...r, approvedAt: updated.approvedAt } : r)))
    } catch (err) {
      setError(err.message)
    } finally {
      setApprovingId(null)
    }
  }

  return (
    <div className="rubric-page">
      <AppNav
        role="owner"
        current={onDone ? 'rubricManage' : 'rubric'}
        onNavigate={onNavigate}
        onChangePassword={onChangePassword}
        onLogout={onLogout}
      >
        {onDone && (
          <button type="button" className="btn-primary-sm" onClick={onResetRules}>
            기준 재설정
          </button>
        )}
      </AppNav>

      {(!onDone || showSteps) && <StepSidebar current={3} onStepClick={onDone ? onStepClick : undefined} />}

      <div className="rubric-wrap">
        <div className="rubric-head">
          <img className="mascot-hero" src={mascotCoach} alt="" />
          <div className="eyebrow mono">매장 정보 · 루브릭 {onDone ? '관리' : '승인'}</div>
          <h1>{onDone ? '채점 기준을 확인·수정해보세요' : '이 기준으로 채점해도 될까요?'}</h1>
          <p className="sub">
            {onDone
              ? '시나리오별 채점 기준이에요. 필요하면 직접 수정하고, 바뀐 내용은 다시 승인해주세요.'
              : '방금 정한 매장 규정을 AI가 시나리오 3개마다 채점 가능한 기준으로 정리했어요. 필요하면 직접 수정하고, 시나리오별로 각각 승인해주세요.'}
          </p>
        </div>

        <div className="rubric-tabs">
          {rubrics.map((rubric, i) => (
            <button
              key={rubric.id}
              type="button"
              className={`rubric-tab ${i === activeIndex ? 'active' : ''}`}
              onClick={() => {
                setActiveIndex(i)
                setEditingIndex(null)
              }}
            >
              {rubric.scenarioTitle}
              {rubric.approvedAt ? ' ✓' : ''}
            </button>
          ))}
        </div>

        {active.criteria.map((criterion, i) => {
          const isEditing = editingIndex === i

          return (
            <div key={i} className="criterion-card glass">
              <div className="criterion-top">
                <div className="criterion-title">{criterion.item}</div>
                <button
                  type="button"
                  className={`req-toggle ${criterion.required ? '' : 'optional'}`}
                  onClick={() => toggleRequired(i)}
                  disabled={saving}
                >
                  {criterion.required ? '필수' : '선택'}
                </button>
              </div>

              {isEditing ? (
                <>
                  <textarea
                    className="good-input"
                    value={draftGood}
                    onChange={(event) => setDraftGood(event.target.value)}
                  />
                  <textarea
                    className="bad-input"
                    value={draftBad}
                    onChange={(event) => setDraftBad(event.target.value)}
                  />
                  <div className="criterion-edit-actions">
                    <button type="button" className="btn-ghost" onClick={cancelEdit}>
                      취소
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => saveEdit(i)}
                      disabled={saving}
                    >
                      {saving ? '저장 중...' : '저장'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="example-row good">
                    <span className="example-icon">✓</span>
                    <span>{criterion.good_example}</span>
                  </div>
                  <div className="example-row bad">
                    <span className="example-icon">✗</span>
                    <span>{criterion.bad_example}</span>
                  </div>
                  <div className="criterion-meta">
                    <button type="button" className="edit-link" onClick={() => startEdit(i, criterion)}>
                      EDITABLE · 수정하기
                    </button>
                  </div>
                </>
              )}
            </div>
          )
        })}

        {error && <p className="rubric-error">{error}</p>}

        {active.approvedAt ? (
          <p className="rubric-approved-note">이 시나리오는 승인 완료됐어요.</p>
        ) : (
          <div className="footer-bar">
            <div className="footer-actions">
              <button type="button" className="btn-ghost" onClick={onBack}>
                ← 이전
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleApprove(active)}
                disabled={approvingId === active.id || saving}
              >
                {approvingId === active.id ? '승인 중...' : '이 기준으로 승인하기'}
              </button>
            </div>
          </div>
        )}

        {allApproved && (
          <div className="approved-card glass">
            <img src={mascotApprove} alt="" />
            <h3>시나리오 {rubrics.length}개 모두 승인됐어요</h3>
            <p>이제부터 이 기준으로 알바 훈련·채점이 진행돼요.</p>
            {onDone ? (
              <button type="button" className="btn-primary" onClick={onDone}>
                대시보드로 돌아가기
              </button>
            ) : (
              <>
                <button type="button" className="btn-primary" onClick={onInvite}>
                  알바 초대하기 →
                </button>
                <button type="button" className="btn-ghost home-link-btn" onClick={onHome}>
                  홈으로
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default RubricApproval
