import { useState } from 'react'
import './RulesInput.css'
import StepSidebar from './StepSidebar'
import mascotApprove from '../../img/mascot-approve.png'
import mascotConfused from '../../img/mascot-confused.png'

const INITIAL_RULES = [
  {
    id: 1,
    label: 'GREETING',
    title: '인사말',
    example: '"어서오세요, 주문 도와드릴게요"로 시작하고, 손님이 나갈 땐 "감사합니다, 좋은 하루 되세요"로 마무리해요.',
    mascot: 'approve',
    enabled: true, //토글 활성화
  },
  {
    id: 2,
    label: 'CUSTOM ORDER',
    title: '커스텀 음료 요청',
    example: '시럽·얼음량 등 변경 요청은 먼저 "네 가능해요"로 답한 뒤, 추가 비용이 있으면 결제 전에 안내해요.',
    mascot: 'approve',
    enabled: true,
  },
  {
    id: 3,
    label: 'TAKEOUT / STAY',
    title: '포장 · 매장 이용 확인',
    example: '주문받을 때 "포장이세요, 매장에서 드시고 가세요?"를 빠짐없이 먼저 물어봐요.',
    mascot: 'approve',
    enabled: true,
  },
  {
    id: 4,
    label: 'COMPLAINT',
    title: '컴플레인 대응',
    example: '맛·품질 관련 컴플레인은 "불편 드려 죄송해요"로 먼저 공감하고, 재제조 또는 환불 여부는 매니저에게 확인 후 안내해요.',
    mascot: 'confused',
    enabled: false,
  },
]

function RulesInput({ onHome, onNext, onBack, manualText }) {
  const [rules, setRules] = useState(() => {
    const trimmedManual = (manualText ?? '').trim()
    if (!trimmedManual) return INITIAL_RULES

    const manualRule = {
      id: 'manual',
      label: 'FROM MANUAL',
      title: '업로드한 매뉴얼 기반 규정',
      example: trimmedManual,
      mascot: 'approve',
      enabled: true,
    }

    return [manualRule, ...INITIAL_RULES]
  })
  const [newRuleTitle, setNewRuleTitle] = useState('')
  const [newRuleContent, setNewRuleContent] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftContent, setDraftContent] = useState('')

  function toggleRule(id) { //스위치를 클릭했을 때 실행될 함수
    setRules((prev) =>
      prev.map((rule) => (rule.id === id ? { ...rule, enabled: !rule.enabled } : rule)) //반대로
    )
  }

  function startEdit(rule) {
    setEditingId(rule.id)
    setDraftTitle(rule.title)
    setDraftContent(rule.example)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  function saveEdit(id) {
    const title = draftTitle.trim()
    const content = draftContent.trim()
    if (!title || !content) return

    setRules((prev) =>
      prev.map((rule) => (rule.id === id ? { ...rule, title, example: content } : rule))
    )
    setEditingId(null)
  }

  function handleAddRule(event) {
    event.preventDefault()
    const title = newRuleTitle.trim()
    const content = newRuleContent.trim()
    if (!title || !content) return

    const newRule = {
      id: Date.now(),
      label: 'CUSTOM',
      title,
      example: content,
      mascot: 'approve',
      enabled: true,
    }

    setRules((prev) => [...prev, newRule])
    setNewRuleTitle('')
    setNewRuleContent('')
  }

  const enabledCount = rules.filter((rule) => rule.enabled).length //rules 중 enabled가 true인 것만 세는 파생값. 하단에 "4개 중 3개 사용" 표시할 때 사용할 예정.

  return (
    <div className="rules-page">
      <nav className="rules-nav">
        <button type="button" className="logo-word mono" onClick={onHome}>
          albafit
        </button>
        <span className="rules-nav-step mono">STEP 2 / 3</span>
      </nav>

      <StepSidebar current={2} />

      <div className="rules-wrap">
        <div className="rules-head">
          <img className="mascot-hero" src={mascotApprove} alt="" />
          <div className="eyebrow mono">매장 정보 · 규정 예시 확인</div>
          <h1>이렇게 응대하면 어떨까요?</h1>
          <p className="sub">
            카페에서 자주 나오는 상황 기준으로 예시를 준비했어요. 필요 없는 항목은 끄고, 문장은
            직접 수정해서 우리 매장 기준으로 만드세요.
          </p>
          <span className="industry-tag mono">☕ 카페 · 디저트 기준</span>
        </div>

        {rules.map((rule) => {
          const isEditing = editingId === rule.id

          return (
            <div key={rule.id} className={`rule-card glass ${rule.enabled ? '' : 'disabled'}`}>
              <div className="rule-top">
                <div className="rule-top-left">
                  <img src={rule.mascot === 'approve' ? mascotApprove : mascotConfused} alt="" />
                  <div>
                    <div className="rule-label mono">{rule.label}</div>
                    {isEditing ? (
                      <input
                        type="text"
                        className="rule-title-input"
                        value={draftTitle}
                        onChange={(event) => setDraftTitle(event.target.value)}
                      />
                    ) : (
                      <div className="rule-title">{rule.title}</div>
                    )}
                  </div>
                </div>
                <button
                  className={`switch ${rule.enabled ? '' : 'off'}`}
                  onClick={() => toggleRule(rule.id)}
                />
              </div>

              {isEditing ? (
                <textarea
                  className="rule-example-input"
                  value={draftContent}
                  onChange={(event) => setDraftContent(event.target.value)}
                />
              ) : (
                <div className="rule-example">{rule.example}</div>
              )}

              {isEditing ? (
                <div className="edit-actions">
                  <button type="button" className="btn-ghost" onClick={cancelEdit}>
                    취소
                  </button>
                  <button type="button" className="btn-primary" onClick={() => saveEdit(rule.id)}>
                    저장
                  </button>
                </div>
              ) : (
                <div className="rule-meta mono">
                  {rule.enabled ? (
                    <button type="button" className="edit-link" onClick={() => startEdit(rule)}>
                      EDITABLE · 수정하기
                    </button>
                  ) : (
                    '꺼짐'
                  )}
                </div>
              )}
            </div>
          )
        })}

        <form className="add-rule-card glass" onSubmit={handleAddRule}>
          <div className="add-rule-label mono">+ 새 규정 직접 추가하기</div>
          <input
            type="text"
            className="add-rule-title-input"
            value={newRuleTitle}
            onChange={(event) => setNewRuleTitle(event.target.value)}
            placeholder="주제 (예: 시식 요청 제한)"
          />
          <div className="add-rule-row">
            <input
              type="text"
              value={newRuleContent}
              onChange={(event) => setNewRuleContent(event.target.value)}
              placeholder="내용 (예: 시식 요청은 하루 1인 1회로 제한해요)"
            />
            <button type="submit" className="btn-primary">
              추가
            </button>
          </div>
        </form>

        <div className="footer-bar">
          <span className="footer-note">
            {rules.length}개 중 {enabledCount}개 사용 · 언제든 다시 수정할 수 있어요
          </span>
          <div className="footer-actions">
            <button type="button" className="btn-ghost" onClick={onBack}>
              ← 이전
            </button>
            <button type="button" className="btn-primary" onClick={onNext}>
              이 기준으로 확정하기 →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RulesInput
