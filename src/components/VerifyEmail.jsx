import { useEffect, useRef, useState } from 'react'
import './Login.css'
import mascotApprove from '../../img/mascot-approve.png'
import mascotConfused from '../../img/mascot-confused.png'
import { apiFetch } from '../lib/api'

function VerifyEmail({ onHome, token }) {
  const [status, setStatus] = useState('checking') // checking | success | error
  // StrictMode(개발 모드)가 이 effect를 일부러 두 번 실행시킨다. 인증 토큰은 한 번 쓰면 서버에서
  // 지워지는 1회용이라, 가드 없이 두 번 호출하면 두 번째 호출이 "이미 없는 토큰"으로 실패해서
  // 실제로는 성공했는데 화면엔 실패로 뜨는 문제가 생긴다.
  const hasRequested = useRef(false)

  useEffect(() => {
    if (hasRequested.current) return
    hasRequested.current = true

    if (!token) {
      setStatus('error')
      return
    }
    apiFetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, { auth: false })
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'))
  }, [token])

  return (
    <div className="auth-page">
      <nav className="auth-nav">
        <button type="button" className="logo-word mono" onClick={onHome}>
          albafit
        </button>
      </nav>

      <div className="auth-wrap">
        <div className="head">
          <img
            className="mascot-hero"
            src={status === 'success' ? mascotApprove : mascotConfused}
            alt=""
          />
          <h1>
            {status === 'checking' && '확인하는 중이에요...'}
            {status === 'success' && '이메일 인증 완료!'}
            {status === 'error' && '인증에 실패했어요'}
          </h1>
          <p className="sub">
            {status === 'success' && '이제 albafit의 모든 기능을 쓸 수 있어요.'}
            {status === 'error' && '링크가 만료됐거나 이미 사용된 링크예요. 로그인 후 다시 보내드릴게요.'}
          </p>
        </div>

        {status !== 'checking' && (
          <div className="auth-card glass">
            <button type="button" className="btn-primary" onClick={onHome}>
              홈으로
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default VerifyEmail
