import { useState } from 'react'
import './StaffInvite.css'
import mascotGreeting from '../../img/mascot-greeting.png'

const INITIAL_INVITEES = [
  { id: 1, name: '김민지', meta: '010-1234-5678 · 어제 초대됨', status: 'pending' },
  { id: 2, name: '이서준', meta: '010-9876-5432 · 훈련 진행중', status: 'active' },
]

const INVITE_LINK = 'albafit.app/invite/cafe-a1b2c3'

function StaffInvite({ onHome, onDashboard }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [invitees, setInvitees] = useState(INITIAL_INVITEES)
  const [copied, setCopied] = useState(false)

  function handleInvite(event) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return

    const newInvitee = {
      id: Date.now(),
      name: trimmedName,
      meta: `${phone.trim() || '연락처 미입력'} · 방금 초대됨`,
      status: 'pending',
    }

    setInvitees((prev) => [newInvitee, ...prev])
    setName('')
    setPhone('')
  }

  function handleCopy() {
    navigator.clipboard?.writeText(INVITE_LINK)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="invite-page">
      <nav className="invite-nav">
        <button type="button" className="logo-word mono" onClick={onHome}>
          albafit
        </button>
        <button type="button" className="nav-link" onClick={onDashboard}>
          대시보드로 돌아가기
        </button>
      </nav>

      <div className="invite-wrap">
        <div className="head">
          <img className="mascot-hero" src={mascotGreeting} alt="" />
          <div className="eyebrow mono">알바 관리 · 초대</div>
          <h1>새 알바를 초대해보세요</h1>
          <p className="sub">
            이름과 연락처를 입력하면 초대 링크를 보내드려요. 알바가 링크로 들어오면 확정된 카페
            기준으로 바로 훈련이 시작돼요.
          </p>
        </div>

        <form className="invite-card glass" onSubmit={handleInvite}>
          <div className="field-row">
            <div className="field">
              <label htmlFor="invite-name">이름</label>
              <input
                id="invite-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="김민지"
              />
            </div>
            <div className="field">
              <label htmlFor="invite-phone">전화번호</label>
              <input
                id="invite-phone"
                type="text"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="010-0000-0000"
              />
            </div>
          </div>
          <button type="submit" className="btn-primary">
            초대 문자 보내기
          </button>

          <div className="link-row">
            <span>{INVITE_LINK}</span>
            <button type="button" className="btn-copy" onClick={handleCopy}>
              {copied ? '복사됨!' : '링크 복사'}
            </button>
          </div>
        </form>

        <div className="section-label">초대 현황 · {invitees.length}명</div>
        {invitees.map((invitee) => (
          <div key={invitee.id} className="invitee-row glass">
            <div className="avatar-initial">{invitee.name.slice(0, 2)}</div>
            <div>
              <div className="invitee-name">{invitee.name}</div>
              <div className="invitee-meta">{invitee.meta}</div>
            </div>
            <span className={`status-chip ${invitee.status}`}>
              {invitee.status === 'active' ? '훈련중' : '응답 대기'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default StaffInvite
