import { useState } from 'react'
import './Login.css'
import mascotGreeting from '../../img/mascot-greeting.png'
import { apiFetch, setTokens } from '../lib/api'

// 사장님 전용 회원가입. 알바 계정은 셀프 가입이 아니라 사장님이 대시보드에서 만들어준다.
function Signup({ onHome, onLogin, onSignupSuccess }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('비밀번호는 8자 이상으로 만들어주세요.')
      return
    }
    setLoading(true)
    try {
      const data = await apiFetch('/api/auth/signup', {
        method: 'POST',
        auth: false,
        body: { name: name.trim(), email: email.trim(), password, role: 'owner' },
      })
      setTokens(data)
      onSignupSuccess(data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <nav className="auth-nav">
        <button type="button" className="logo-word mono" onClick={onHome}>
          albafit
        </button>
      </nav>

      <div className="auth-wrap">
        <div className="head">
          <img className="mascot-hero" src={mascotGreeting} alt="" />
          <h1>사장님 회원가입</h1>
          <p className="sub">
            매장 기준을 등록하고 알바를 훈련시키려면 먼저 계정을 만들어주세요.
          </p>
        </div>

        <form className="auth-card glass" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="signup-name">이름</label>
            <input
              id="signup-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="김사장"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="signup-email">이메일</label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="signup-password">비밀번호</label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="8자 이상"
              required
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '가입 중...' : '회원가입'}
          </button>

          <p className="auth-switch">
            이미 계정이 있으신가요?{' '}
            <button type="button" className="auth-switch-link" onClick={onLogin}>
              로그인
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}

export default Signup
