import { useState } from 'react'
import './RulesInput.css'
import StepSidebar from './StepSidebar'
import AppNav from './AppNav'
import mascotApprove from '../../img/mascot-approve.png'
import mascotConfused from '../../img/mascot-confused.png'
import { apiFetch } from '../lib/api'
import { INDUSTRIES } from '../lib/industries'

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

// 저장된 규칙 원문("제목: 내용" 형태로 두 줄바꿈마다 구분됨 — handleConfirm이 저장할 때 쓰는 형식 그대로)을
// 다시 카드 배열로 되돌린다. "재설정" 화면에서 그동안 입력한 규칙을 카드로 불러올 때 씀.
function parseRulesText(rawText) {
  const trimmed = (rawText ?? '').trim()
  if (!trimmed) return []

  return trimmed.split('\n\n').map((chunk, i) => {
    const sepIndex = chunk.indexOf(': ')
    const title = sepIndex === -1 ? `규정 ${i + 1}` : chunk.slice(0, sepIndex)
    const example = sepIndex === -1 ? chunk : chunk.slice(sepIndex + 2)
    return { id: `saved-${i}`, label: 'SAVED', title, example, mascot: 'approve', enabled: true }
  })
}

function RulesInput({
  onNext,
  onBack,
  onNavigate,
  onChangePassword,
  onLogout,
  onStepClick,
  manualRules,
  linkKey,
  resetMode,
  initialRawText,
  initialItems,
  user,
}) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [rules, setRules] = useState(() => {
    // 매뉴얼 텍스트를 Gemini가 규칙 단위로 나눈 결과 — 카드 하나로 뭉치지 않고 여러 개로 보여준다.
    // 온보딩(STEP1)과 재설정(STEP1) 둘 다 매뉴얼을 새로 입력할 수 있어서 공통으로 쓴다.
    const manualCards = (manualRules ?? []).map((rule, i) => ({
      id: `manual-${i}`,
      label: '매뉴얼 기반',
      title: rule.title,
      example: rule.content,
      mascot: 'approve',
      enabled: true,
    }))

    if (resetMode) {
      // items가 있으면(이 컬럼이 생긴 뒤에 저장된 제출) 카드별 원래 라벨을 그대로 복원한다.
      // 없으면(과거 데이터) raw_text를 파싱해서 SAVED로만 표시하는 옛 방식으로 폴백한다.
      const loaded =
        initialItems && initialItems.length > 0
          ? initialItems.map((item, i) => ({ id: `saved-${i}`, enabled: true, ...item }))
          : parseRulesText(initialRawText)
      if (loaded.length === 0 && manualCards.length === 0) return INITIAL_RULES
      return [...manualCards, ...loaded]
    }

    if (manualCards.length === 0) return INITIAL_RULES
    return [...manualCards, ...INITIAL_RULES]
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

  // 켜져 있는 규칙만 모아서 하나의 규정 원문으로 합친 뒤, 실제로 저장 + 루브릭 생성 API를 호출한다.
  async function handleConfirm() {
    setError('')
    const enabledRules = rules.filter((rule) => rule.enabled)
    if (enabledRules.length === 0) {
      setError('최소 하나 이상의 규정을 켜주세요.')
      return
    }

    const rawText = enabledRules.map((rule) => `${rule.title}: ${rule.example}`).join('\n\n')
    // 카드별 원래 라벨(label)을 그대로 저장 — "기준 재설정"에서 다음에 다시 불러올 때 SAVED로
    // 뭉뚱그리지 않고 이 라벨 그대로 복원하기 위함. rawText(Gemini 프롬프트용)엔 안 섞는다.
    const items = enabledRules.map(({ label, title, example, mascot }) => ({
      label,
      title,
      example,
      mascot,
    }))

    setLoading(true)
    try {
      const data = await apiFetch(`/api/stores/${linkKey}/rules`, {
        method: 'POST',
        body: { rawText, items },
      })
      onNext(data.rubrics)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rules-page">
      <AppNav role="owner" current="rules" onNavigate={onNavigate} onChangePassword={onChangePassword} onLogout={onLogout} />

      <StepSidebar current={2} onStepClick={onStepClick} />

      <div className="rules-wrap">
        <div className="rules-head">
          <img className="mascot-hero" src={mascotApprove} alt="" />
          <div className="eyebrow mono">매장 정보 · 규정 예시 확인</div>
          {resetMode ? (
            <>
              <h1>규칙을 다시 확인해보세요</h1>
              <p className="sub">
                지금까지 저장된 규칙이에요. 필요 없는 항목은 끄고, 문장을 고치거나 새로 추가한 뒤
                확정하면 채점 기준이 새로 만들어져요.
              </p>
            </>
          ) : (
            <>
              <h1>이렇게 응대하면 어떨까요?</h1>
              <p className="sub">
                카페에서 자주 나오는 상황 기준으로 예시를 준비했어요. 필요 없는 항목은 끄고, 문장은
                직접 수정해서 우리 매장 기준으로 만드세요.
              </p>
            </>
          )}
          <span className="industry-tag mono">
            {INDUSTRIES.find((i) => i.key === user?.store?.industry)?.icon ?? '☕'}{' '}
            {INDUSTRIES.find((i) => i.key === user?.store?.industry)?.label ?? '카페 · 디저트'} 기준
          </span>
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

        {error && <p className="rules-error">{error}</p>}

        <div className="footer-bar">
          <span className="footer-note">
            {rules.length}개 중 {enabledCount}개 사용 · 언제든 다시 수정할 수 있어요
          </span>
          <div className="footer-actions">
            <button type="button" className="btn-ghost" onClick={onBack}>
              ← 이전
            </button>
            <button type="button" className="btn-primary" onClick={handleConfirm} disabled={loading}>
              {loading ? '루브릭 만드는 중...' : '이 기준으로 확정하기 →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RulesInput
