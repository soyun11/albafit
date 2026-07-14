import './OwnerDashboard.css'
import mascotCoach from '../../img/mascot-coach.png'

const STAFF = [
  { id: 1, name: '이서준', progress: 100, done: '8/8', score: '94점', status: 'done' },
  { id: 2, name: '박지호', progress: 45, done: '3/8', score: '88점', status: 'active' },
  { id: 3, name: '최유나', progress: 25, done: '2/8', score: '—', status: 'active' },
  { id: 4, name: '김민지', progress: 0, done: '0/8', score: '—', status: 'pending' },
]

const STATUS_LABEL = {
  done: '훈련 완료',
  active: '훈련중',
  pending: '응답 대기',
}

function OwnerDashboard({ onHome, onInvite, onViewReport }) {
  return (
    <div className="dashboard-page">
      <nav className="dashboard-nav">
        <button type="button" className="logo-word mono" onClick={onHome}>
          albafit
        </button>
        <div className="nav-links">
          <span className="current">대시보드</span>
          <span>기준 관리</span>
          <span>리포트</span>
        </div>
        <button type="button" className="btn-primary-sm" onClick={onInvite}>
          + 알바 초대
        </button>
      </nav>

      <div className="dashboard-wrap">
        <div className="head-row">
          <div>
            <h1>안녕하세요, 사장님</h1>
            <p>오늘 2명이 훈련을 진행하고 있어요</p>
          </div>
          <span className="industry-tag mono">☕ 카페 · 디저트 기준 적용중</span>
        </div>

        <div className="stat-grid">
          <div className="stat glass">
            <b>6명</b>
            <span>전체 알바</span>
          </div>
          <div className="stat glass">
            <b>91점</b>
            <span>평균 점수</span>
          </div>
          <div className="stat glass">
            <b>2명</b>
            <span>훈련 진행중</span>
          </div>
          <div className="stat glass">
            <b>1명</b>
            <span>초대 대기중</span>
          </div>
        </div>

        <div className="panel glass">
          <div className="panel-top">
            <span className="panel-title">알바 현황</span>
          </div>
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
              {STAFF.map((staff) => (
                <tr key={staff.id} onClick={() => onViewReport(staff.name)}>
                  <td>
                    <div className="name-cell">
                      <div className="avatar-initial">{staff.name.slice(0, 2)}</div>
                      {staff.name}
                    </div>
                  </td>
                  <td>
                    <span className="progress-mini">
                      <span className="progress-mini-fill" style={{ width: `${staff.progress}%` }} />
                    </span>
                    {staff.done}
                  </td>
                  <td className="score-cell">{staff.score}</td>
                  <td>
                    <span className={`status-chip ${staff.status}`}>
                      {STATUS_LABEL[staff.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel glass coach-tip">
          <img src={mascotCoach} alt="" />
          <p>
            <b>박지호</b>님이 컴플레인 대응에서 계속 낮은 점수를 받고 있어요. 이 항목만 다시
            훈련해보시겠어요?
          </p>
        </div>
      </div>
    </div>
  )
}

export default OwnerDashboard
