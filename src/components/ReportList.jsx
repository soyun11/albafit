import { useEffect, useState } from 'react'
import './ReportList.css'
import AppNav from './AppNav'
import { apiFetch } from '../lib/api'

const STATUS_LABEL = {
  done: '훈련 완료',
  active: '훈련중',
  pending: '응답 대기',
}

function ReportList({ onNavigate, onChangePassword, onLogout, onViewReport }) {
  const [staff, setStaff] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch('/api/stores/me/staff-report')
      .then((data) => setStaff(data.staff))
      .catch((err) => setError(err.message))
  }, [])

  return (
    <div className="report-list-page">
      <AppNav role="owner" current="reports" onNavigate={onNavigate} onChangePassword={onChangePassword} onLogout={onLogout} />

      <div className="report-list-wrap">
        <h1>알바 리포트</h1>
        <p className="sub">
          알바를 선택하면 훈련 결과와 교정 피드백을 볼 수 있어요.{' '}
          <button type="button" className="link-inline" onClick={() => onNavigate('correctionHistory')}>
            정정 이력 모아보기 →
          </button>
        </p>

        {error && <p className="report-list-error">{error}</p>}

        {staff && staff.length === 0 && (
          <p className="report-list-empty">아직 초대한 알바가 없어요. "알바 관리"에서 먼저 계정을 만들어주세요.</p>
        )}

        {staff && staff.length > 0 && (
          <div className="panel glass">
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
          </div>
        )}
      </div>
    </div>
  )
}

export default ReportList
