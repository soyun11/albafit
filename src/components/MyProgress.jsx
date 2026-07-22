import { useEffect, useState } from 'react'
import './MyProgress.css'
import AppNav from './AppNav'
import mascotApprove from '../../img/mascot-approve.png'
import { apiFetch } from '../lib/api'

function MyProgress({ onNavigate, onChangePassword, onLogout }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch('/api/stores/me/my-progress')
      .then(setData)
      .catch((err) => setError(err.message))
  }, [])

  return (
    <div className="progress-page">
      <AppNav role="staff" current="myProgress" onNavigate={onNavigate} onChangePassword={onChangePassword} onLogout={onLogout} />

      <div className="progress-wrap">
        {error && <p className="progress-error">{error}</p>}

        {data && (
          <>
            <div className="hero-card glass">
              <img src={mascotApprove} alt="" />
              <div className="hero-text">
                <div className="eyebrow mono">나의 훈련 현황</div>
                <h1>{data.staffName ?? '나'}님, 잘하고 계세요</h1>
                <p>
                  {data.totalCount > 0
                    ? `${data.totalCount}개 상황 중 ${data.completedCount}개 완료했어요`
                    : '아직 훈련 가능한 상황이 없어요'}
                </p>
              </div>
            </div>

            <div className="stat-row">
              <div className="stat glass">
                <b>{data.latestScore != null ? `${data.latestScore}점` : '—'}</b>
                <span>최근 점수</span>
              </div>
              <div className="stat glass">
                <b>
                  {data.completedCount}/{data.totalCount}
                </b>
                <span>완료한 상황</span>
              </div>
            </div>

            <div className="section-label">최근 훈련 기록</div>
            <div className="history-panel glass">
              {data.recentHistory.length === 0 ? (
                <p className="progress-empty">아직 완료한 훈련이 없어요. 시나리오를 골라 첫 훈련을 시작해보세요.</p>
              ) : (
                data.recentHistory.map((item) => (
                  <div key={item.sessionId} className="history-row">
                    <span className="history-date mono">{new Date(item.date).toLocaleDateString('ko-KR')}</span>
                    <span className="history-scenario">{item.scenarioTitle}</span>
                    <span className="history-score">{item.score != null ? `${item.score}점` : '—'}</span>
                  </div>
                ))
              )}
            </div>

            <button type="button" className="btn-primary" onClick={() => onNavigate('scenario')}>
              시나리오 선택으로
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default MyProgress
