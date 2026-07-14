import { useState } from 'react'
import './RubricApproval.css'
import StepSidebar from './StepSidebar'
import mascotCoach from '../../img/mascot-coach.png'
import mascotApprove from '../../img/mascot-approve.png'

const INITIAL_CRITERIA = [
  {
    id: 1,
    item: '인사말 확인',
    required: true,
    goodExample:
      '"어서오세요, 주문 도와드릴게요"로 시작하고, 손님이 나갈 땐 "감사합니다, 좋은 하루 되세요"로 마무리한다.',
    badExample: '인사 없이 바로 주문만 받거나, 손님이 나갈 때 아무 말도 하지 않는다.',
  },
  {
    id: 2,
    item: '커스텀 음료 요청 응대',
    required: true,
    goodExample: '"네 가능해요"로 먼저 답한 뒤, 추가 비용이 있으면 결제 전에 안내한다.',
    badExample: '가능 여부를 먼저 말하지 않거나, 비용 안내 없이 그냥 결제부터 진행한다.',
  },
  {
    id: 3,
    item: '포장 · 매장 이용 확인',
    required: false,
    goodExample: '주문받을 때 "포장이세요, 매장에서 드시고 가세요?"를 빠짐없이 먼저 물어본다.',
    badExample: '포장/매장 여부를 확인하지 않고 임의로 처리한다.',
  },
]

function RubricApproval({ onHome, onBack, onInvite }) {
  const [criteria, setCriteria] = useState(INITIAL_CRITERIA)
  const [approved, setApproved] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [draftGood, setDraftGood] = useState('')
  const [draftBad, setDraftBad] = useState('')

  function toggleRequired(id) {
    setCriteria((prev) =>
      prev.map((criterion) =>
        criterion.id === id ? { ...criterion, required: !criterion.required } : criterion
      )
    )
  }

  function startEdit(criterion) {
    setEditingId(criterion.id)
    setDraftGood(criterion.goodExample)
    setDraftBad(criterion.badExample)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  function saveEdit(id) {
    const good = draftGood.trim()
    const bad = draftBad.trim()
    if (!good || !bad) return

    setCriteria((prev) =>
      prev.map((criterion) =>
        criterion.id === id ? { ...criterion, goodExample: good, badExample: bad } : criterion
      )
    )
    setEditingId(null)
  }

  function selectAllRequired() {
    setCriteria((prev) => prev.map((criterion) => ({ ...criterion, required: true })))
  }

  function handleApprove() {
    setApproved(true)
  }

  function handleRevise() {
    setApproved(false)
  }

  return (
    <div className="rubric-page">
      <nav className="rubric-nav">
        <button type="button" className="logo-word mono" onClick={onHome}>
          albafit
        </button>
        <span className="rubric-nav-step mono">STEP 3 / 3</span>
      </nav>

      <StepSidebar current={3} />

      <div className="rubric-wrap">
        <div className="rubric-head">
          <img className="mascot-hero" src={mascotCoach} alt="" />
          <div className="eyebrow mono">매장 정보 · 루브릭 승인</div>
          <h1>이 기준으로 채점해도 될까요?</h1>
          <p className="sub">
            방금 정한 매장 규정을 AI가 채점 가능한 기준으로 정리했어요. 필수/선택 여부와 예시를
            확인하고, 필요하면 직접 수정한 뒤 승인해주세요.
          </p>
          <button type="button" className="select-all-btn mono" onClick={selectAllRequired}>
            모두 필수로 설정
          </button>
        </div>

        {criteria.map((criterion) => {
          const isEditing = editingId === criterion.id

          return (
            <div key={criterion.id} className="criterion-card glass">
              <div className="criterion-top">
                <div className="criterion-title">{criterion.item}</div>
                <button
                  type="button"
                  className={`req-toggle ${criterion.required ? '' : 'optional'}`}
                  onClick={() => toggleRequired(criterion.id)}
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
                      onClick={() => saveEdit(criterion.id)}
                    >
                      저장
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="example-row good">
                    <span className="example-icon">✓</span>
                    <span>{criterion.goodExample}</span>
                  </div>
                  <div className="example-row bad">
                    <span className="example-icon">✗</span>
                    <span>{criterion.badExample}</span>
                  </div>
                  <div className="criterion-meta">
                    <button
                      type="button"
                      className="edit-link"
                      onClick={() => startEdit(criterion)}
                    >
                      수정하기
                    </button>
                  </div>
                </>
              )}
            </div>
          )
        })}

        {approved ? (
          <div className="approved-card glass">
            <img src={mascotApprove} alt="" />
            <h3>루브릭이 승인됐어요</h3>
            <p>이제부터 이 기준으로 알바 훈련·채점이 진행돼요.</p>
            <button type="button" className="btn-primary" onClick={onInvite}>
              알바 초대하기 →
            </button>
            <button type="button" className="btn-ghost home-link-btn" onClick={onHome}>
              홈으로
            </button>
            <button type="button" className="revise-link" onClick={handleRevise}>
              승인 취소하고 다시 수정하기
            </button>
          </div>
        ) : (
          <div className="footer-bar">
            <div className="footer-actions">
              <button type="button" className="btn-ghost" onClick={onBack}>
                ← 이전
              </button>
              <button type="button" className="btn-primary" onClick={handleApprove}>
                이 기준으로 승인하기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default RubricApproval
