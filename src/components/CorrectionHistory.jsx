import { useEffect, useState } from 'react'
import './ReportList.css'
import AppNav from './AppNav'
import { apiFetch } from '../lib/api'

function metLabel(met) {
  return met ? '충족' : '미충족'
}

function CorrectionHistory({ onNavigate, onChangePassword, onLogout }) {
  const [corrections, setCorrections] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch('/api/stores/me/corrections')
      .then((data) => setCorrections(data.corrections))
      .catch((err) => setError(err.message))
  }, [])

  return (
    <div className="report-list-page">
      <AppNav role="owner" current="correctionHistory" onNavigate={onNavigate} onChangePassword={onChangePassword} onLogout={onLogout} />

      <div className="report-list-wrap">
        <h1>채점 검토 이력</h1>
        <p className="sub">사장님이 평가 캘리브레이션에서 남긴 교정을 최근 순으로 모아봐요.</p>

        {error && <p className="report-list-error">{error}</p>}

        {corrections && corrections.length === 0 && (
          <p className="report-list-empty">아직 남긴 교정이 없어요. 리포트에서 "AI 채점 검토하기"로 들어가 확인해보세요.</p>
        )}

        {corrections && corrections.length > 0 && (
          <div className="panel glass">
            <table className="staff-table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>알바</th>
                  <th>시나리오</th>
                  <th>바뀐 항목</th>
                  <th>코멘트</th>
                </tr>
              </thead>
              <tbody>
                {corrections.map((c) => (
                  <tr key={c.turnId} className="no-click">
                    <td>{new Date(c.correctedAt).toLocaleDateString('ko-KR')}</td>
                    <td>{c.staffName}</td>
                    <td>{c.scenarioTitle}</td>
                    <td>
                      {c.changedItems.length === 0 ? (
                        <span className="status-chip pending">확인만 함</span>
                      ) : (
                        c.changedItems.map((item) => (
                          <div key={item.item}>
                            {item.item} · {metLabel(item.originalMet)} → {metLabel(item.correctedMet)}
                          </div>
                        ))
                      )}
                    </td>
                    <td>{c.comment || '—'}</td>
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

export default CorrectionHistory
