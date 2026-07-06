import './ProjectIntro.css'

const PROBLEMS = [
  '신입 알바가 손님 앞에서 당황한다',
  '사장님이 같은 설명을 계속 반복한다',
  '바쁜 시간대의 실수는 바로 리뷰/클레임으로 이어진다',
  '레시피는 외웠는데 실제 응대는 못 한다',
  '사장님 입장에서는 교육에 쓸 시간도, 반복 설명할 여력도 부족하다',
]

const COMPARISON = [
  { before: '매뉴얼을 만들어줌', after: 'AI 손님과 실제 상황을 연습시킴' },
  { before: '직원이 모르는 걸 챗봇에 질문', after: '답변을 입력하면 매장 규칙 기준으로 평가·피드백' },
  { before: '문서형 교육', after: '상황극 훈련' },
]

const SCENARIOS = [
  { title: '음료 지연', check: '사과 / 대기시간 안내 체크' },
  { title: '품절 메뉴', check: '사과 / 대체 메뉴 / 환불 안내 체크' },
  { title: '매장 규칙 위반 손님', check: '규칙 안내 / 부드러운 대안 제시 체크' },
]

function ProjectIntro() {
  return (
    <main className="intro">
      <header className="intro-header">
        <span className="eyebrow">매장 상황극 훈련 서비스</span>
        <h1>첫 출근 알바생을 위한 매장 상황극 훈련</h1>
        <p className="lead">
          사장님이 매장 규칙과 자주 발생하는 고객 응대 상황을 입력하면, AI가 알바생을 위한 상황극
          훈련을 생성하고, 알바생의 답변을 매장 규칙 기준으로 평가해 개선 피드백을 제공하는
          웹 서비스입니다.
        </p>
      </header>

      <section className="intro-section">
        <h2>문제 정의</h2>
        <ul className="problem-list">
          {PROBLEMS.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      </section>

      <section className="intro-section">
        <h2>차별화 포인트</h2>
        <div className="table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th>기존 서비스</th>
                <th>이 서비스</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.before}>
                  <td className="before">{row.before}</td>
                  <td>{row.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="quote">
          "매뉴얼을 읽히는 서비스가 아니라, 매장별 실제 상황을 AI 손님과 연습시키는 훈련 서비스"
        </p>
      </section>

      <section className="intro-section">
        <h2>시나리오 예시 (카페 기준)</h2>
        <ol className="scenario-list">
          {SCENARIOS.map((scenario, index) => (
            <li key={scenario.title} className="scenario-card">
              <span className="scenario-num">{index + 1}</span>
              <div>
                <strong>{scenario.title}</strong>
                <p>{scenario.check}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}

export default ProjectIntro
