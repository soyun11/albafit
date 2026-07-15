import { useState } from 'react'
import './EmailVerifyBanner.css'
import { apiFetch } from '../lib/api'

// 사장님 계정이면서 아직 이메일 인증을 안 한 경우에만 보이는 배너. 화면 진입 자체는 막지 않는다.
function EmailVerifyBanner({ user }) {
  const [status, setStatus] = useState('idle') // idle | sending | sent | error

  if (!user || user.role !== 'owner' || user.emailVerifiedAt) return null

  async function handleResend() {
    setStatus('sending')
    try {
      await apiFetch('/api/auth/resend-verification', { method: 'POST' })
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="email-verify-banner">
      <span>이메일 인증이 필요해요. 받은 메일함(스팸함도 확인)에서 링크를 눌러주세요.</span>
      <button type="button" onClick={handleResend} disabled={status === 'sending' || status === 'sent'}>
        {status === 'sent' ? '재발송 완료' : status === 'sending' ? '보내는 중...' : '인증 메일 재발송'}
      </button>
    </div>
  )
}

export default EmailVerifyBanner
