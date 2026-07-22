import { useEffect, useState } from 'react'
import './OwnerDashboard.css'
import mascotCoach from '../../img/mascot-coach.png'
import EmailVerifyBanner from './EmailVerifyBanner'
import AppNav from './AppNav'
import { apiFetch } from '../lib/api'

// IndustrySelect.jsx의 업종 목록과 동일한 아이콘·라벨 — 대시보드 상단 태그가 실제 매장 업종을 보여주게.
const INDUSTRY_LABELS = {
  cafe: '☕ 카페 · 디저트 기준 적용중',
  convenience: '🏪 편의점 기준 적용중',
  restaurant: '🍽️ 음식점 · 외식 기준 적용중',
  mart: '🛒 마트 · 유통 기준 적용중',
  pcroom: '🎮 PC방 · 오락실 기준 적용중',
  beauty: '💇 뷰티 · 헤어 기준 적용중',
}

const STATUS_LABEL = {
  done: '훈련 완료',
  active: '훈련중',
  pending: '응답 대기',
}

// docs/dashboard-staff-consolidation.md — 알바 목록(예전 "리포트")·초대(예전 "알바 관리")를
// 전부 대시보드로 합쳤다. onViewReport는 App.jsx의 handleViewReport(개별 상세 리포트로 이동).
function OwnerDashboard({ onNavigate, onChangePassword, onLogout, onViewReport, user }) {
  // 예전엔 이 통계·코치팁이 전부 하드코딩된 mock이었다 — /me/staff-report로 실제 훈련 기록을
  // 집계해서 채운다. 알바가 아직 없거나 아무도 훈련을 안 했으면 stats 값이 0/null로 자연스럽게 온다.
  const [stats, setStats] = useState(null)
  const [coachTip, setCoachTip] = useState(null)
  const [staff, setStaff] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch('/api/stores/me/staff-report')
      .then((data) => {
        setStats(data.stats)
        setCoachTip(data.coachTip)
        setStaff(data.staff)
      })
      .catch((err) => setError(err.message))
  }, [])

  return (
    <div className="dashboard-page">
      <AppNav role="owner" current="dashboard" onNavigate={onNavigate} onChangePassword={onChangePassword} onLogout={onLogout} />

      <div className="dashboard-wrap">
        <EmailVerifyBanner user={user} />

        <div className="head-row">
          <div>
            <h1>안녕하세요, 사장님</h1>
            <p>{stats ? `지금 ${stats.activeCount}명이 훈련을 진행하고 있어요` : '오늘 현황을 불러오고 있어요...'}</p>
          </div>
          <span className="industry-tag mono">
            {INDUSTRY_LABELS[user?.store?.industry] ?? INDUSTRY_LABELS.cafe}
          </span>
        </div>

        <div className="stat-grid">
          <div className="stat glass">
            <b>{stats ? `${stats.totalStaff}명` : '—'}</b>
            <span>전체 알바</span>
          </div>
          <div className="stat glass">
            <b>{stats?.avgScore != null ? `${stats.avgScore}점` : '—'}</b>
            <span>평균 점수</span>
          </div>
          <div className="stat glass">
            <b>{stats ? `${stats.activeCount}명` : '—'}</b>
            <span>훈련 진행중</span>
          </div>
          <div className="stat glass">
            <b>{stats ? `${stats.pendingCount}명` : '—'}</b>
            <span>응답 대기중</span>
          </div>
        </div>

        <div className="panel glass">
          <div className="staff-panel-head">
            <span className="panel-title">알바 목록</span>
            <div className="staff-panel-actions">
              <button type="button" className="link-inline" onClick={() => onNavigate('correctionHistory')}>
                정정 이력 모아보기 →
              </button>
              <button type="button" className="btn-primary-sm" onClick={() => onNavigate('invite')}>
                + 새 알바 초대
              </button>
            </div>
          </div>

          {error && <p className="dashboard-error">{error}</p>}

          {staff && staff.length === 0 && (
            <p className="dashboard-empty">아직 초대한 알바가 없어요. "+ 새 알바 초대"로 계정을 만들어주세요.</p>
          )}

          {staff && staff.length > 0 && (
            <table className="staff-table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>진행률</th>
                  <th>최근 점수</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((member) => (
                  <tr
                    key={member.id}
                    className={member.status === 'pending' ? 'no-click' : ''}
                    onClick={() => member.status !== 'pending' && onViewReport(member)}
                  >
                    <td>
                      <div className="name-cell">
                        <div className="avatar-initial">{member.name.slice(0, 2)}</div>
                        {member.name}
                      </div>
                    </td>
                    <td>
                      <span className="progress-mini">
                        <span className="progress-mini-fill" style={{ width: `${member.progress}%` }} />
                      </span>
                      {member.done}
                    </td>
                    <td className="score-cell">{member.score}</td>
                    <td>
                      <span className={`status-chip ${member.status}`}>{STATUS_LABEL[member.status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {coachTip && (
          <div className="panel glass coach-tip">
            <img src={mascotCoach} alt="" />
            <p>
              <b>{coachTip.staffName}</b>님이 "{coachTip.item}" 기준에서 계속 낮은 점수를 받고 있어요.
              이 항목만 다시 훈련해보시겠어요?
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default OwnerDashboard
