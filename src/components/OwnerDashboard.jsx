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

function OwnerDashboard({ onNavigate, onChangePassword, onLogout, user }) {
  // 예전엔 이 통계·코치팁이 전부 하드코딩된 mock이었다 — /me/staff-report로 실제 훈련 기록을
  // 집계해서 채운다. 알바가 아직 없거나 아무도 훈련을 안 했으면 stats 값이 0/null로 자연스럽게 온다.
  const [stats, setStats] = useState(null)
  const [coachTip, setCoachTip] = useState(null)

  useEffect(() => {
    apiFetch('/api/stores/me/staff-report')
      .then((data) => {
        setStats(data.stats)
        setCoachTip(data.coachTip)
      })
      .catch(() => {
        // 조회 실패해도 대시보드 자체는 보여준다 — 통계 카드만 빈 상태로 남는다.
      })
  }, [])

  return (
    <div className="dashboard-page">
      <AppNav role="owner" current="dashboard" onNavigate={onNavigate} onChangePassword={onChangePassword} onLogout={onLogout}>
        <button type="button" className="btn-primary-sm" onClick={() => onNavigate('invite')}>
          + 알바 초대
        </button>
      </AppNav>

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

        <button type="button" className="report-link-card glass" onClick={() => onNavigate('reports')}>
          <span className="panel-title">알바 리포트 보기 →</span>
          <span className="report-link-sub">누가 뭘 잘하고 있는지, 어디서 막히는지 한눈에 확인해요.</span>
        </button>

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
