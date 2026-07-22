import { useState } from 'react'
import './Login.css'
import AppNav from './AppNav'
import mascotCoach from '../../img/mascot-coach.png'
import { apiFetch } from '../lib/api'

// 로그인된 상태에서만 접근. 알바가 사장님이 정해준 초기 비밀번호를 바꿀 때 주로 쓴다.
function ChangePassword({ onBack, role, onNavigate, onChangePassword, onLogout }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (newPassword.length < 8) {
      setError('새 비밀번호는 8자 이상으로 만들어주세요.')
      return
    }
    setLoading(true)
    try {
      await apiFetch('/api/auth/password', {
        method: 'PATCH',
        body: { currentPassword, newPassword },
      })
      setDone(true)
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <AppNav role={role} onNavigate={onNavigate} onChangePassword={onChangePassword} onLogout={onLogout} />

      <div className="auth-wrap">
        <div className="head">
          <img className="mascot-hero" src={mascotCoach} alt="" />
          <h1>비밀번호 변경</h1>
          <p className="sub">처음 받은 비밀번호를 나만 아는 걸로 바꿔보세요.</p>
        </div>

        <form className="auth-card glass" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="current-password">현재 비밀번호</label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="new-password">새 비밀번호</label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="8자 이상"
              required
            />
          </div>

          {error && <p className="auth-error">{error}</p>}
          {done && <p className="field-hint">비밀번호를 바꿨어요.</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '변경 중...' : '비밀번호 변경'}
          </button>

          <p className="auth-switch">
            <button type="button" className="auth-switch-link" onClick={onBack}>
              뒤로 가기
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}

export default ChangePassword
