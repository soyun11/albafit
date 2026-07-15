import { useState } from 'react'
import './StaffInvite.css'
import mascotGreeting from '../../img/mascot-greeting.png'
import AppNav from './AppNav'
import { apiFetch } from '../lib/api'

function StaffInvite({ onNavigate, onChangePassword, onLogout }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [staffList, setStaffList] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreate(event) {
    event.preventDefault()
    setError('')
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    if (!trimmedName || !trimmedEmail || password.length < 8) {
      setError('이름, 이메일을 채우고 비밀번호는 8자 이상으로 만들어주세요.')
      return
    }

    setLoading(true)
    try {
      const staff = await apiFetch('/api/stores/me/staff', {
        method: 'POST',
        body: { name: trimmedName, email: trimmedEmail, password },
      })
      setStaffList((prev) => [staff, ...prev])
      setName('')
      setEmail('')
      setPassword('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="invite-page">
      <AppNav role="owner" current="invite" onNavigate={onNavigate} onChangePassword={onChangePassword} onLogout={onLogout} />

      <div className="invite-wrap">
        <div className="head">
          <img className="mascot-hero" src={mascotGreeting} alt="" />
          <div className="eyebrow mono">알바 관리 · 계정 추가</div>
          <h1>새 알바 계정을 만들어보세요</h1>
          <p className="sub">
            이메일과 초기 비밀번호를 정해서 계정을 만들면, 그 정보를 알바에게 직접 알려주세요.
            알바는 로그인 후 비밀번호를 본인 것으로 바꿀 수 있어요.
          </p>
        </div>

        <form className="invite-card glass" onSubmit={handleCreate}>
          <div className="field-row">
            <div className="field">
              <label htmlFor="staff-name">이름</label>
              <input
                id="staff-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="김민지"
              />
            </div>
            <div className="field">
              <label htmlFor="staff-email">이메일</label>
              <input
                id="staff-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="staff@example.com"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="staff-password">초기 비밀번호</label>
            <input
              id="staff-password"
              type="text"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="8자 이상, 알바에게 직접 알려주세요"
            />
          </div>

          {error && <p className="invite-error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '만드는 중...' : '알바 계정 만들기'}
          </button>
        </form>

        <div className="section-label">이번에 만든 계정 · {staffList.length}명</div>
        {staffList.map((staff) => (
          <div key={staff.id} className="invitee-row glass">
            <div className="avatar-initial">{staff.name?.slice(0, 2)}</div>
            <div>
              <div className="invitee-name">{staff.name}</div>
              <div className="invitee-meta">{staff.email}</div>
            </div>
            <span className="status-chip pending">계정 생성됨</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default StaffInvite
