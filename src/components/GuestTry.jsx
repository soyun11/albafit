import { useState } from 'react'
import './GuestTry.css'
import AppNav from './AppNav'
import mascotGreeting from '../../img/mascot-greeting.png'
import mascotCoach from '../../img/mascot-coach.png'
import mascotApprove from '../../img/mascot-approve.png'
import { INDUSTRIES } from '../lib/industries'
import { GUEST_TOUR_SCENARIOS } from '../lib/guestTourContent'
import { INITIAL_RULES_BY_INDUSTRY } from './RulesInput'

const INVITE_PREVIEW = { name: '김민지', email: 'staff@example.com', password: 'welcome2026' }

// 다음에 뭘 눌러야 하는지 가리키는 주황색 커서 포인터 — 이모지는 폰트마다 렌더링이 달라져서(마우스
// 이모지가 거의 안 보이는 경우도 있었음) 실제 커서 화살표 모양의 SVG를 직접 그린다. 클릭할 요소 쪽에
// position:relative를 걸고 이 컴포넌트를 넣으면 오른쪽 아래에서 다가왔다 눌리는 애니메이션으로 보인다(GuestTry.css).
function CursorHint() {
  return (
    <svg className="guest-cursor-hint" viewBox="-1 -1 14 21" width="26" height="34" aria-hidden="true">
      <polygon
        points="0,0 0,16 4,12.5 6.5,19 9,18 6.5,11.5 12,11.5"
        fill="#fff"
        stroke="#f5911e"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// 로그인·매장 연결 없이, 실제 사장님 온보딩(1 업종·매뉴얼 → 2 규칙확인 → 3 루브릭승인 → 알바 초대)과
// 그 뒤 알바가 로그인해서 훈련하는 흐름까지를 하나의 클릭 파이프라인으로 훑어보는 가이드 투어
// (docs/guest-tour-redesign.md). 타이핑도 AI 호출도 없다 — 전부 정적 콘텐츠라 새로고침하면 처음부터.
function GuestTry({ onNavigate }) {
  const [step, setStep] = useState('industry') // industry | rules | rubric | invite | scenario | tour
  const [industry, setIndustry] = useState(null)
  const [converting, setConverting] = useState(false)
  const [rubricActiveIndex, setRubricActiveIndex] = useState(0)
  const [approvedSet, setApprovedSet] = useState(new Set())
  const [inviting, setInviting] = useState(false)
  const [invited, setInvited] = useState(false)
  const [scenario, setScenario] = useState(null)
  const [revealCount, setRevealCount] = useState(0)

  const scenarios = GUEST_TOUR_SCENARIOS[industry] ?? []
  const rules = INITIAL_RULES_BY_INDUSTRY[industry] ?? []
  const criteria = scenario?.criteria ?? []
  const isDone = revealCount >= criteria.length
  // 매장 매뉴얼 입력칸에 이미 타이핑돼있는 것처럼 보여줄 예시 — 새로 쓰지 않고, 다음 화면(rules)에
  // 카드로 나오는 규칙 예시 중 앞 2개를 문장으로 이어붙인다. "이 텍스트를 AI가 읽어서 옆 카드들로
  // 정리한다"는 게 실제로 보이게 하려는 것.
  const manualPreview = rules
    .filter((r) => r.enabled)
    .slice(0, 2)
    .map((r) => r.example)
    .join(' ')

  const activeRubric = scenarios[rubricActiveIndex]
  const allApproved = scenarios.length > 0 && approvedSet.size === scenarios.length

  function selectIndustry(key) {
    setIndustry(key)
  }

  function confirmRules() {
    setConverting(true)
    setTimeout(() => {
      setConverting(false)
      setRubricActiveIndex(0)
      setApprovedSet(new Set())
      setStep('rubric')
    }, 700)
  }

  function approveRubric(index) {
    setApprovedSet((prev) => new Set(prev).add(index))
    if (index < scenarios.length - 1) setRubricActiveIndex(index + 1)
  }

  function goToInvite() {
    setInviting(false)
    setInvited(false)
    setStep('invite')
  }

  function createStaffAccount() {
    setInviting(true)
    setTimeout(() => {
      setInviting(false)
      setInvited(true)
    }, 600)
  }

  function pickScenario(picked) {
    setScenario(picked)
    setRevealCount(0)
    setStep('tour')
  }

  function revealNext() {
    setRevealCount((prev) => Math.min(prev + 1, criteria.length))
  }

  return (
    <div className="guest-page">
      <AppNav role="guest" onNavigate={onNavigate} />

      <div className="guest-wrap">
        <div className="guest-mode-banner mono">비회원 체험 모드 · 미리 준비된 예시로 둘러보는 투어예요</div>

        {step === 'industry' && (
          <>
            <img className="mascot-hero" src={mascotGreeting} alt="" />
            <div className="eyebrow mono">체험하기 · 1/6</div>
            <h1>어떤 업종이신가요?</h1>
            <div className="guest-grid">
              {INDUSTRIES.map((ind, i) => (
                <button
                  key={ind.key}
                  type="button"
                  className={`guest-card glass ${industry === ind.key ? 'selected' : ''}`}
                  onClick={() => selectIndustry(ind.key)}
                >
                  <span className="guest-card-icon">{ind.icon}</span>
                  <span className="guest-card-title">{ind.label}</span>
                  {!industry && i === 0 && <CursorHint />}
                </button>
              ))}
            </div>

            {industry && (
              <div className="guest-manual-card glass">
                <div className="guest-manual-label mono">+ 매장 매뉴얼 · 규정 입력 (선택)</div>
                <div className="guest-manual-text">{manualPreview}</div>
                <p className="guest-manual-note">사장님이 이렇게 자유롭게 규칙을 적어두면, AI가 다음 화면에서 카드로 정리해드려요.</p>
                <button type="button" className="btn-primary btn-pulse" onClick={() => setStep('rules')}>
                  다음 →
                  <CursorHint />
                </button>
              </div>
            )}
          </>
        )}

        {step === 'rules' && (
          <>
            <img className="mascot-hero" src={mascotGreeting} alt="" />
            <div className="eyebrow mono">체험하기 · 2/6</div>
            <h1>사장님이 이런 규칙을 입력해두면</h1>
            <p className="guest-sub">업종별로 자주 쓰는 규칙 예시예요. 사장님은 이 화면에서 문장을 고치거나 켜고 끄면서 우리 매장 기준으로 확정해요.</p>
            <div className="guest-rules-list">
              {rules.map((rule) => (
                <div key={rule.id} className="guest-rule-card glass">
                  <div className="guest-rule-label mono">{rule.label}</div>
                  <div className="guest-rule-title">{rule.title}</div>
                  <div className="guest-rule-example">{rule.example}</div>
                </div>
              ))}
            </div>
            {converting ? (
              <p className="guest-converting mono">AI가 규칙을 상황별로 나누는 중...</p>
            ) : (
              <button type="button" className="btn-primary btn-pulse" onClick={confirmRules}>
                이 기준으로 확정하기 →
                <CursorHint />
              </button>
            )}
          </>
        )}

        {step === 'rubric' && activeRubric && (
          <>
            <img className="mascot-hero" src={mascotCoach} alt="" />
            <div className="eyebrow mono">체험하기 · 3/6</div>
            <h1>이 기준으로 채점해도 될까요?</h1>
            <p className="guest-sub">방금 정한 규칙을 보고 AI가 실전 상황 {scenarios.length}개를 제안했어요. 시나리오별로 하나씩 확인하고 승인해요.</p>

            <div className="guest-rubric-tabs">
              {scenarios.map((s, i) => (
                <button
                  key={s.title}
                  type="button"
                  className={`guest-rubric-tab ${i === rubricActiveIndex ? 'active' : ''}`}
                  onClick={() => setRubricActiveIndex(i)}
                >
                  {s.title}
                  {approvedSet.has(i) ? ' ✓' : ''}
                </button>
              ))}
            </div>

            <div className="guest-situation-block glass">
              <p><strong>상황</strong> · {activeRubric.situation}</p>
              <p><strong>손님이 이렇게 시작해요</strong> · &ldquo;{activeRubric.opening}&rdquo;</p>
            </div>

            {activeRubric.criteria.map((c, i) => (
              <div key={i} className="guest-criterion-card glass">
                <div className="guest-criterion-top">
                  <span className="guest-criterion-title">{c.item}</span>
                  <span className={`guest-req-badge ${c.required ? '' : 'optional'}`}>{c.required ? '필수' : '선택'}</span>
                </div>
                <div className="guest-example-row good">
                  <span>✓</span>
                  <span>{c.good_example}</span>
                </div>
                <div className="guest-example-row bad">
                  <span>✗</span>
                  <span>{c.bad_example}</span>
                </div>
              </div>
            ))}

            {approvedSet.has(rubricActiveIndex) ? (
              <p className="guest-approved-note">이 시나리오는 승인 완료됐어요.</p>
            ) : (
              <button type="button" className="btn-primary btn-pulse" onClick={() => approveRubric(rubricActiveIndex)}>
                이 기준으로 승인하기
                <CursorHint />
              </button>
            )}

            {allApproved && (
              <div className="guest-done-card glass">
                <img src={mascotApprove} alt="" />
                <h3>시나리오 {scenarios.length}개 모두 승인됐어요</h3>
                <p>이제부터 이 기준으로 알바 훈련·채점이 진행돼요.</p>
                <button type="button" className="btn-primary btn-pulse" onClick={goToInvite}>
                  알바 초대하기 →
                  <CursorHint />
                </button>
              </div>
            )}

            <button type="button" className="btn-ghost" onClick={() => setStep('rules')}>
              ← 규칙 다시 보기
            </button>
          </>
        )}

        {step === 'invite' && (
          <>
            <img className="mascot-hero" src={mascotGreeting} alt="" />
            <div className="eyebrow mono">체험하기 · 4/6</div>
            <h1>새 알바 계정을 만들어보세요</h1>
            <p className="guest-sub">이메일과 초기 비밀번호를 정해서 계정을 만들면, 그 정보를 알바에게 직접 알려주세요.</p>

            <div className="guest-invite-card glass">
              <div className="guest-invite-field">
                <label>이름</label>
                <input type="text" value={INVITE_PREVIEW.name} disabled />
              </div>
              <div className="guest-invite-field">
                <label>이메일</label>
                <input type="text" value={INVITE_PREVIEW.email} disabled />
              </div>
              <div className="guest-invite-field">
                <label>초기 비밀번호</label>
                <input type="text" value={INVITE_PREVIEW.password} disabled />
              </div>

              {invited ? (
                <div className="guest-invitee-row">
                  <div className="guest-avatar-initial">{INVITE_PREVIEW.name.slice(0, 2)}</div>
                  <div>
                    <div className="guest-invitee-name">{INVITE_PREVIEW.name}</div>
                    <div className="guest-invitee-meta">{INVITE_PREVIEW.email}</div>
                  </div>
                  <span className="guest-status-chip">계정 생성됨</span>
                </div>
              ) : (
                <button type="button" className="btn-primary btn-pulse" onClick={createStaffAccount} disabled={inviting}>
                  {inviting ? '만드는 중...' : '알바 계정 만들기'}
                  {!inviting && <CursorHint />}
                </button>
              )}
            </div>

            {invited && (
              <button type="button" className="btn-primary btn-pulse" onClick={() => setStep('scenario')}>
                이제 알바 입장에서 볼까요? →
                <CursorHint />
              </button>
            )}

            <button type="button" className="btn-ghost" onClick={() => setStep('rubric')}>
              ← 승인 화면 다시 보기
            </button>
          </>
        )}

        {step === 'scenario' && (
          <>
            <img className="mascot-hero" src={mascotGreeting} alt="" />
            <div className="eyebrow mono">체험하기 · 5/6</div>
            <h1>이제 알바가 로그인하면</h1>
            <p className="guest-sub">방금 승인한 기준 그대로, 알바는 이 상황들 중 하나를 골라 훈련을 시작해요.</p>
            <div className="guest-grid">
              {scenarios.map((s, i) => (
                <button key={s.title} type="button" className="guest-card glass" onClick={() => pickScenario(s)}>
                  <span className="guest-card-icon">{s.icon}</span>
                  <span className="guest-card-title">{s.title}</span>
                  <span className="guest-card-desc">{s.situation}</span>
                  {i === 0 && <CursorHint />}
                </button>
              ))}
            </div>
            <button type="button" className="btn-ghost" onClick={() => setStep('invite')}>
              ← 계정 만들기 화면으로
            </button>
          </>
        )}

        {step === 'tour' && scenario && (
          <div className="guest-session">
            <div className="guest-progress-row">
              <div className="guest-progress-track">
                <div className="guest-progress-fill" style={{ width: `${(revealCount / criteria.length) * 100}%` }} />
              </div>
              <span className="guest-progress-label">{revealCount} / {criteria.length} 포인트</span>
            </div>

            <div className="guest-session-grid">
              <section className="guest-chat-card glass">
                <span className="guest-scenario-tag">체험하기 · 6/6 · {scenario.title}</span>

                <div className="guest-msg customer">{scenario.opening}</div>

                {criteria.slice(0, revealCount).map((c, i) => (
                  <div key={i} className="guest-exchange">
                    <div className="guest-msg staff">{c.good_example}</div>
                    <div className="guest-msg customer">{c.reaction}</div>
                  </div>
                ))}

                {revealCount > 0 && (
                  <div className="guest-feedback-bubble approve">
                    <img src={mascotApprove} alt="" />
                    <p>"{criteria[revealCount - 1].item}" 포인트를 챙겼어요!</p>
                  </div>
                )}

                {isDone ? (
                  <div className="guest-done-card">
                    <img src={mascotApprove} alt="" />
                    <h3>투어 끝! 어떠셨어요?</h3>
                    <p>실제 매장으로 등록하면, 우리 매장 진짜 규칙으로 AI가 알바를 이렇게 훈련시켜드려요.</p>
                    <button type="button" className="btn-primary" onClick={() => onNavigate('signup')}>
                      무료로 시작하기 →
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setStep('scenario')}>
                      다른 상황도 둘러보기
                    </button>
                  </div>
                ) : (
                  <button type="button" className="btn-primary btn-pulse" onClick={revealNext}>
                    직원이 이렇게 답하면 좋아요
                    <CursorHint />
                  </button>
                )}
              </section>

              <aside className="guest-side-col">
                <div className="guest-hint-card glass">
                  <img src={mascotCoach} alt="" />
                  <div>
                    <h4>AI 트레이너 힌트</h4>
                    <p>{isDone ? '체크리스트를 다 채웠어요!' : '버튼을 눌러 모범 답변을 하나씩 확인해보세요.'}</p>
                  </div>
                </div>
                <div className="guest-checklist glass">
                  {criteria.map((c, i) => (
                    <div key={i} className="guest-checklist-item">
                      <div className={`guest-dot ${i < revealCount ? 'ok' : ''}`} />
                      <span className="guest-checklist-label">{c.item}</span>
                      <span className={`guest-req-badge ${c.required ? '' : 'optional'}`}>{c.required ? '필수' : '선택'}</span>
                    </div>
                  ))}
                </div>
                <div className="guest-metric glass">
                  <span>포인트 확인</span>
                  <b>{revealCount} / {criteria.length}</b>
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
