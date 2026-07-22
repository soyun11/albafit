import { useState } from 'react'
import './IndustrySelect.css'
import StepSidebar from './StepSidebar'
import AppNav from './AppNav'
import mascotGreeting from '../../img/mascot-greeting.png'
import mascotCoach from '../../img/mascot-coach.png'
import EmailVerifyBanner from './EmailVerifyBanner'
import { INDUSTRIES } from '../lib/industries'

const HINTS = {
  cafe: '카페를 선택하면 커스텀 음료·포장·매장 이용 관련 응대 예시가 다음 화면에 먼저 채워져요.',
}
const DEFAULT_HINT = '이 업종은 아직 준비된 예시가 없어요. 카페 예시를 참고해서 직접 입력해주세요.'

// 이 화면에서는 아직 매장이 없어서(다음 클릭 시 생성됨) 매장 있어야 의미 있는 링크는 눌러도
// 갈 곳이 없다 — 회색으로 비활성화만 해서 "이런 메뉴들이 있다"는 건 보여준다.
const NO_STORE_YET = ['dashboard', 'rubricManage']

function IndustrySelect({ onBack, onNext, onNavigate, onChangePassword, onLogout, user, resetMode, onStepClick, initialManualText }) {
  // 재설정 흐름이면 이미 정해진 매장 업종으로 시작하고 바꿀 수 없게 한다 — 업종 변경은
  // 시나리오 자체가 바뀌는 큰 변경이라 지금은 지원하지 않는다.
  const [selectedIndustry, setSelectedIndustry] = useState(resetMode ? user?.store?.industry ?? 'cafe' : 'cafe')
  // 재설정 흐름에서 STEP1로 돌아오면, 지금 저장돼있는 규칙 텍스트로 채워서 보여준다. manualEdited가
  // false인 동안은 읽기전용으로만 보여주고(EDITABLE · 수정하기를 눌러야 편집 가능) — 건드리지 않고
  // "다음"을 누르면 이 텍스트는 AI 분리 파이프라인을 다시 안 탄다(아래 handleNext 참고). 최초
  // 온보딩(resetMode 아닐 때)은 보여줄 기존 내용이 없으니 처음부터 빈 입력칸으로 시작한다.
  const [manualText, setManualText] = useState(resetMode ? (initialManualText ?? '') : '')
  const [manualEdited, setManualEdited] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const hint = HINTS[selectedIndustry] ?? DEFAULT_HINT
  // true면 아직 "수정하기"를 안 눌러서 저장된 텍스트를 읽기전용으로만 보여주는 상태.
  const showManualReference = resetMode && Boolean(initialManualText) && !manualEdited

  async function handleNext() {
    setError('')
    setLoading(true)
    try {
      if (showManualReference) {
        // 안 건드렸으면 빈 텍스트를 보낸다 — AI 분리를 다시 안 태워서, STEP2에서 이미 복원된
        // 저장된 카드와 중복되는 카드가 새로 생기는 걸 막는다(docs/rubric-reset-flow.md).
        await onNext(selectedIndustry, '', false)
      } else {
        // 직접 수정했으면(또는 애초에 온보딩이라 편집 상태로 시작했으면) 지금 이 칸의 전체 내용을
        // 새 원문으로 삼는다 — replaceExisting=true로 넘겨서 App.jsx가 예전 저장 규칙을 지우고
        // 이 칸 내용만으로 다시 만들게 한다(그래야 여기서 지운 문장이 실제로 사라진다).
        await onNext(selectedIndustry, manualText, resetMode)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="industry-page">
      <AppNav
        role="owner"
        current="industry"
        onNavigate={onNavigate}
        onChangePassword={onChangePassword}
        onLogout={onLogout}
        disabledKeys={resetMode ? [] : NO_STORE_YET}
      />

      <StepSidebar current={1} onStepClick={onStepClick} />

      <div className="industry-wrap">
        <EmailVerifyBanner user={user} />
        <img className="mascot-hero" src={mascotGreeting} alt="" />
        <div className="eyebrow mono">{resetMode ? '매장 정보 · 업종 확인' : '매장업종선택 · 매뉴얼입력'}</div>
        {resetMode ? (
          <>
            <h1>매장 업종</h1>
            <p className="sub">
              업종은 매장을 처음 만들 때 정해져서 지금은 바꿀 수 없어요. 규칙·루브릭은 step2·3에서
              계속 수정할 수 있어요.
            </p>
          </>
        ) : (
          <>
            <h1>어떤 업종이신가요?</h1>
            <p className="sub">
              업종에 맞는 응대 예시를 먼저 보여드리고, 그 예시를 바탕으로 매장 기준을 다음 화면에서
              확정하실 수 있어요.
            </p>
          </>
        )}

        <div className="industry-grid">
          {INDUSTRIES.map((industry) => {
            const isSelected = selectedIndustry === industry.key

            return (
              <button
                key={industry.key}
                type="button"
                className={`industry-card glass ${isSelected ? 'selected' : ''}`}
                onClick={() => !resetMode && setSelectedIndustry(industry.key)}
                disabled={resetMode && !isSelected}
              >
                <span className="industry-icon">{industry.icon}</span>
                <span className="industry-label">{industry.label}</span>
                <div className="check" />
              </button>
            )
          })}
        </div>

        {!resetMode && (
          <div className="hint glass">
            <img src={mascotCoach} alt="" />
            <span>{hint}</span>
          </div>
        )}

        {/* 재설정 모드에서도 매뉴얼 입력란은 그대로 둔다 — 업종은 못 바꿔도 매뉴얼은 언제든
            고치거나 새로 추가해서 규칙확인(step2)에 반영할 수 있어야 한다. 저장된 내용이 있으면
            "EDITABLE · 수정하기"를 눌러야 편집되는 읽기전용으로 시작 — 실수로 안 건드렸는데 AI가
            다시 쪼개서 STEP2에 중복 카드가 생기는 걸 막는다(docs/rubric-reset-flow.md). */}
        <div className="manual-card glass">
          <div className="manual-label mono">+ 매장 매뉴얼 · 규정 입력 (선택)</div>
          {showManualReference ? (
            <>
              <div className="manual-reference">{initialManualText}</div>
              <button type="button" className="btn-ghost manual-edit-btn" onClick={() => setManualEdited(true)}>
                ✏️ 수정하기
              </button>
            </>
          ) : (
            <textarea
              className="manual-input"
              value={manualText}
              onChange={(event) => setManualText(event.target.value)}
              placeholder="예: 저희 매장은 포장 손님에게 빨대를 요청 시에만 드려요. 마감 30분 전에는 신메뉴 주문을 받지 않아요."
            />
          )}
          <p className="manual-note">
            {showManualReference
              ? '지금 저장된 규칙이에요. 수정하기를 눌러 고치거나 지우면, 다음으로 넘어갈 때 그 내용 그대로 규칙확인 화면 카드를 새로 만들어드려요.'
              : resetMode
                ? '여기 내용을 AI가 읽고, 다음 화면(규칙확인)의 카드를 이 내용 기준으로 다시 만들어드려요.'
                : '여기에 적은 내용을 AI가 읽고, 다음 화면(규칙확인)에 초안 카드로 만들어드려요.'}
          </p>
          <button type="button" className="btn-ghost photo-upload-btn">
            📷 사진으로 업로드 (준비 중)
          </button>
        </div>

        {error && <p className="industry-error">{error}</p>}

        <div className="footer-bar">
          <div className="footer-actions">
            <button type="button" className="btn-ghost" onClick={onBack}>
              ← 이전
            </button>
            <button type="button" className="btn-primary" onClick={handleNext} disabled={loading}>
              {loading ? '이동 중...' : '다음 →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default IndustrySelect
