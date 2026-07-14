import './Home.css'
import mascotGreeting from '../../img/mascot-greeting.png'

const SCREENS = [
  {
    key: 'industry',
    title: '매장업종선택 · 매뉴얼입력',
    description: '사장님이 매장 업종을 고르고 매뉴얼을 입력하는 화면',
  },
  { key: 'rules', title: '규칙확인', description: 'AI가 만든 규칙을 사장님이 확인·수정하는 화면' },
  { key: 'rubric', title: '루브릭승인', description: 'AI가 만든 채점 기준을 승인하는 화면' },
  { key: 'invite', title: '매장링크전달', description: '사장님이 알바를 초대하는 화면' },
  { key: 'scenario', title: '시나리오선택', description: '알바가 훈련 상황을 고르는 화면' },
  { key: 'training', title: '훈련대화', description: '알바가 AI 손님과 연습하는 화면' },
  { key: 'feedback', title: '훈련결과요약', description: '훈련이 끝난 뒤 피드백을 보는 화면' },
  { key: 'dashboard', title: '사장님리포트', description: '사장님이 알바 훈련 현황을 보는 화면' },
]

function Home({ onNavigate, onBack }) {
  return (
    <div className="home-page">
      <div className="home-wrap">
        <button type="button" className="back-link mono" onClick={onBack}>
          ← 랜딩페이지로
        </button>
        <img className="mascot-hero" src={mascotGreeting} alt="" />
        <div className="eyebrow mono">albafit 프로토타입 · 화면 목록</div>
        <h1>어떤 화면을 볼까요?</h1>
        <p className="sub">아직 만들어진 화면 8개예요. 눌러서 확인해보세요.</p>

        <div className="home-grid">
          {SCREENS.map((screen) => (
            <button
              key={screen.key}
              type="button"
              className="home-card glass"
              onClick={() => onNavigate(screen.key)}
            >
              <h3>{screen.title}</h3>
              <p>{screen.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Home
