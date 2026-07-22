import { useEffect, useState } from 'react'
import './ReportList.css'
import AppNav from './AppNav'
import { apiFetch } from '../lib/api'

function sortSessions(sessions, sortBy) {
  return [...sessions].sort((a, b) =>
    sortBy === 'name' ? a.staffName.localeCompare(b.staffName, 'ko') : new Date(b.completedAt) - new Date(a.completedAt),
  )
}

function SessionReview({ onViewReport, onNavigate, onChangePassword, onLogout }) {
  const [sessions, setSessions] = useState(null)
  const [error, setError] = useState('')
  const [sortBy, setSortBy] = useState('recent')

  useEffect(() => {
    apiFetch('/api/stores/me/sessions')
      .then((data) => setSessions(data.sessions))
      .catch((err) => setError(err.message))
  }, [])

  const sorted = sessions ? sortSessions(sessions, sortBy) : null

  return (
    <div className="report-list-page">
      <AppNav role="owner" current="sessionReview" onNavigate={onNavigate} onChangePassword={onChangePassword} onLogout={onLogout} />

      <div className="report-list-wrap">
        <h1>채점 검토</h1>
        <p className="sub">완료된 훈련 세션을 골라 AI 채점을 확인·교정할 수 있어요.</p>

        <div className="sort-toggle">
          <button type="button" className={sortBy === 'recent' ? 'active' : ''} onClick={() => setSortBy('recent')}>
            최신순
          </button>
          <button type="button" className={sortBy === 'name' ? 'active' : ''} onClick={() => setSortBy('name')}>
            이름순
          </button>
        </div>

        {error && <p className="report-list-error">{error}</p>}

        {sorted && sorted.length === 0 && <p className="report-list-empty">아직 완료된 훈련 세션이 없어요.</p>}

        {sorted && sorted.length > 0 && (
          <div className="panel glass">
            <table className="staff-table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>알바</th>
                  <th>시나리오</th>
                  <th>점수</th>
                  <th>기준 충족</th>
                  <th>교정 여부</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((s) => (
                  <tr key={s.sessionId} onClick={() => onViewReport(s.sessionId)}>
                    <td>{new Date(s.completedAt).toLocaleDateString('ko-KR')}</td>
                    <td>{s.staffName}</td>
                    <td>{s.scenarioTitle}</td>
                    <td className="score-cell">{s.score != null ? `${s.score}점` : '—'}</td>
                    <td>
                      {s.passedCount}/{s.totalCount}
                    </td>
                    <td>
                      <span className={`status-chip ${s.hasCorrection ? 'done' : 'pending'}`}>
                        {s.hasCorrection ? '교정함' : '미검토'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default SessionReview
