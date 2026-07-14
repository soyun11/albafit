import './LandingPage.css'
import mascotGreeting from '../../img/mascot-greeting.png'
import mascotApprove from '../../img/mascot-approve.png'
import mascotConfused from '../../img/mascot-confused.png'
import mascotCoach from '../../img/mascot-coach.png'

function LandingPage({ onStart, onMenu }) {
  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <div className="logo">
          <div className="logo-mark">A</div>
          <span className="logo-word">albafit</span>
        </div>
        <div className="nav-links">
          <span>기능</span>
          <span>도입사례</span>
          <button type="button" className="nav-menu-link" onClick={onMenu}>
            전체 화면 목록
          </button>
        </div>
        <button type="button" className="nav-cta" onClick={onStart}>
          시작하기
        </button>
      </nav>

      <div className="hero">
        <h1>
          <span>매장 맞춤 AI 롤플레잉 트레이너</span> &amp; 실시간 교정 피드백 에이전트가
          <br />
          신입 알바를 첫날부터 전문가로 만듭니다
          <br />
          <span className="hero-sub-accent">연중무휴 24시간</span>
        </h1>
        <p>AI가 새 알바에게 실전처럼 대화 연습을 시키고, 매장 기준에 맞게 교정 피드백까지 챙겨드려요.</p>
        <div className="cta-row">
          <button type="button" className="btn-primary" onClick={onStart}>
            시작하기 →
          </button>
        </div>

        <div className="hero-preview glass">
          <div className="preview-topbar">
            <img src={mascotGreeting} alt="" className="preview-avatar" />
            <span className="preview-name">AI 트레이너</span>
            <span className="preview-label mono">TRAINING · LIVE SESSION</span>
          </div>
          <div className="preview-body">
            <div className="chat-pane">
              <div className="msg customer">저기요, 이거 환불되나요? 뜯었는데.</div>
              <div className="msg staff">확인 도와드릴게요, 혹시 영수증 있으실까요?</div>
              <div className="feedback-chip mono">
                <img src={mascotApprove} alt="" />
                공감 먼저, 확인 절차 순서 좋아요
              </div>
              <div className="msg customer">네 여기요.</div>
              <div className="msg staff">개봉 상품은 교환만 가능한 점 참고 부탁드려요!</div>
              <div className="feedback-chip warn mono">
                <img src={mascotConfused} alt="" />
                매장 기준: "죄송하지만" 먼저 붙이기
              </div>
            </div>
            <div className="metric-pane">
              <div className="metric glass">
                <b>94점</b>
                <span>기준 부합도</span>
              </div>
              <div className="metric glass">
                <b>3건</b>
                <span>교정 피드백</span>
              </div>
              <div className="metric glass">
                <b>4분 12초</b>
                <span>훈련 소요 시간</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="trust-strip">
        <div className="trust-item glass">
          <b>340+</b>&nbsp;도입 매장
        </div>
        <div className="trust-item glass">
          <b>12,400건</b>&nbsp;누적 훈련 세션
        </div>
        <div className="trust-item glass">
          <b>4.8/5</b>&nbsp;점주 만족도
        </div>
        <div className="trust-item glass">
          <b>2.3일</b>&nbsp;평균 적응 기간 단축
        </div>
      </div>

      <section className="block">
        <div className="block-head-row">
          <div className="block-head-text">
            <div className="eyebrow mono">albafit이 다른 이유</div>
            <div className="section-title">일반 매뉴얼이 아니라, 우리 매장 기준으로</div>
            <div className="section-desc no-margin">
              체인점마다, 사장님마다 응대 기준은 다 달라요. albafit은 표준 매뉴얼 대신 이 매장이
              정한 기준 그대로 AI를 학습시켜요.
            </div>
          </div>
          <img className="block-head-img" src={mascotCoach} alt="" />
        </div>
        <div className="block-spacer" />
        <div className="steps">
          <div className="step glass">
            <div className="step-num mono">FIT 01</div>
            <h3>우리 매장 말투 그대로</h3>
            <p>"손님" 대신 "고객님", 반말 금지 같은 이 매장만의 규칙을 AI가 그대로 지켜요.</p>
          </div>
          <div className="step glass">
            <div className="step-num mono">FIT 02</div>
            <h3>우리 업종 상황 그대로</h3>
            <p>카페면 커스텀 음료, 편의점이면 재고 문의처럼 실제로 자주 나오는 상황만 훈련해요.</p>
          </div>
          <div className="step glass">
            <div className="step-num mono">FIT 03</div>
            <h3>우리 정책 그대로</h3>
            <p>환불, 교환, 할인 기준처럼 매장마다 다른 정책을 AI가 정확히 구분해서 알려줘요.</p>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="eyebrow mono">사용 방법</div>
        <div className="section-title">세 단계면 훈련이 끝나요</div>
        <div className="section-desc">
          기준을 한 번 입력하면, 그 다음부터는 새 알바가 들어올 때마다 AI가 알아서 연습을
          시켜드려요.
        </div>
        <div className="steps">
          <div className="step glass">
            <div className="step-num mono">01</div>
            <h3>응대 기준 입력</h3>
            <p>환불 규정, 인사 멘트, 톤앤매너 등 우리 매장만의 기준을 텍스트나 매뉴얼로 알려주세요.</p>
          </div>
          <div className="step glass">
            <div className="step-num mono">02</div>
            <h3>AI와 실전 롤플레이</h3>
            <p>새 알바가 까다로운 손님, 컴플레인 등 실제 상황을 AI 고객과 대화로 연습해요.</p>
          </div>
          <div className="step glass">
            <div className="step-num mono">03</div>
            <h3>교정 피드백 리포트</h3>
            <p>어떤 표현이 기준에 어긋났는지, 무엇을 고치면 좋을지 바로 확인해요.</p>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="eyebrow mono">교육 전 / 후</div>
        <div className="section-title">같은 상황, 다른 응대</div>
        <div className="section-desc">
          훈련 전후로 같은 컴플레인 상황에 어떻게 다르게 답하는지 비교해드려요.
        </div>
        <div className="ba-grid">
          <div className="ba-card before glass">
            <div className="ba-label mono">BEFORE</div>
            <div className="ba-line">"어... 그건 안 되는데요. 저희 규정이라서요."</div>
          </div>
          <div className="ba-card after glass">
            <div className="ba-label mono">AFTER</div>
            <div className="ba-line">
              "불편 드려 죄송해요, 다만 개봉 상품은 교환으로 도와드리고 있어요. 괜찮으실까요?"
            </div>
          </div>
        </div>
      </section>

      <div className="footer-cta">
        <div className="logo footer-logo">
          <div className="logo-mark">A</div>
          <span className="logo-word">albafit</span>
        </div>
        <h2>지금 기준 한 번만 알려주세요</h2>
        <p>다음 알바부터는 albafit이 대신 훈련시켜 드려요.</p>
        <button type="button" className="btn-primary" onClick={onStart}>
          무료로 시작하기 →
        </button>
      </div>
    </div>
  )
}

export default LandingPage
