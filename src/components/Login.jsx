import { useState } from 'react'
import './Login.css'
import mascotGreeting from '../../img/mascot-greeting.png'
import { apiFetch, setTokens } from '../lib/api'

function Login({ onHome, onSignup, onLoginSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        auth: false,
        body: { email: email.trim(), password },
      })
      setTokens(data)
      onLoginSuccess(data.user)
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
          <h1>로그인</h1>
          <p className="sub">사장님, 알바 계정 모두 이메일로 로그인해요.</p>
        </div>

        <form className="auth-card glass" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="login-email">이메일</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="login-password">비밀번호</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="비밀번호"
              required
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </button>

          <p className="auth-switch">
            아직 계정이 없으신 사장님이신가요?{' '}
            <button type="button" className="auth-switch-link" onClick={onSignup}>
              회원가입
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}

export default Login
