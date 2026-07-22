import { useState } from 'react'
import './StaffEditModal.css'
import { apiFetch } from '../lib/api'

// 알바 계정 이메일·비밀번호 수정 모달 (docs/staff-account-recovery.md). 표 안 인라인 펼침 행이었던
// 걸 사용자 피드백("UI가 불편하다")으로 교체 — 이 프로젝트에 모달이 처음 생기는 자리다.
// 비밀번호 칸은 비워두면 안 바뀐다 — 이메일만 고치고 싶을 때 비밀번호를 다시 정할 필요는 없어야 한다.
function StaffEditModal({ staff, onClose, onSaved }) {
  const [email, setEmail] = useState(staff.email)
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(event) {
    event.preventDefault()
    setError('')
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError('이메일을 입력해주세요.')
      return
    }
    if (newPassword && newPassword.length < 8) {
      setError('새 비밀번호는 8자 이상으로 만들어주세요.')
      return
    }

    setSaving(true)
    try {
      const body = { email: trimmedEmail, ...(newPassword && { newPassword }) }
      const updated = await apiFetch(`/api/stores/me/staff/${staff.id}`, { method: 'PATCH', body })
      onSaved(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="staff-modal-backdrop" onClick={onClose}>
      <div className="staff-modal-card" onClick={(event) => event.stopPropagation()}>
        <h3>{staff.name}님 계정 수정</h3>
        <form onSubmit={handleSave}>
          <div className="field">
            <label htmlFor="staff-edit-email">이메일</label>
            <input
              id="staff-edit-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="staff-edit-password">새 비밀번호</label>
            <input
              id="staff-edit-password"
              type="text"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="바꾸려면 입력(8자 이상) · 비워두면 그대로 유지"
            />
          </div>

          {error && <p className="staff-modal-error">{error}</p>}

          <div className="staff-modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default StaffEditModal
