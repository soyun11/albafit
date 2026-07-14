import {useState} from 'react';
import './TrainingSession.css';

import mascotGreeting from '../../img/mascot-greeting.png'
import mascotCoach from '../../img/mascot-coach.png'
import mascotApprove from '../../img/mascot-approve.png'
import mascotConfused from '../../img/mascot-confused.png'

// 시나리오별 mock 데이터 묶음. ScenarioSelect 화면에서 고른 scenario 값으로 이 중 하나를 골라 씀.
const SCENARIOS = {
  delay: {
    tag: '음료 지연',
    greeting: '안녕하세요! 오늘은 음료 지연 상황을 연습해봐요.',
    messages: [
      { sender: 'customer', text: '아이스 아메리카노 시킨 지 좀 됐는데, 얼마나 더 걸릴까요?' },
      { sender: 'staff', text: '죄송합니다, 바로 확인해드릴게요.' },
      { sender: 'customer', text: '네, 부탁드려요.' },
    ],
    checklist: [
      { id: 1, label: '사과 표현', status: 'ok' },
      { id: 2, label: '주문 확인 절차', status: 'ok' },
      { id: 3, label: '예상 대기시간 안내', status: 'wait' },
      { id: 4, label: '대안 제시 (서비스 등)', status: 'wait' },
    ],
    customerLines: [
      '음... 알겠어요. 근데 너무 오래 기다린 것 같아서 좀 아쉽네요.',
      '오, 감사합니다! 그럼 조금만 더 기다릴게요.',
    ],
    hints: {
      3: '예상 대기시간을 구체적으로 안내해보세요. "지금 만들고 있어요, 2분 정도만 더 기다려주시면 될 것 같아요" 처럼요.',
      4: '기다려주신 것에 대한 작은 보상(예: 쿠키 서비스)을 제안해보세요.',
    },
  },
  outOfStock: {
    tag: '품절 메뉴',
    greeting: '안녕하세요! 오늘은 품절 메뉴 상황을 연습해봐요.',
    messages: [
      { sender: 'customer', text: '바닐라 라떼 하나 주세요.' },
      { sender: 'staff', text: '죄송한데 바닐라 시럽이 방금 다 떨어졌어요.' },
      { sender: 'customer', text: '아 진짜요? 그럼 뭐로 바꿀 수 있어요?' },
    ],
    checklist: [
      { id: 1, label: '사과 표현', status: 'ok' },
      { id: 2, label: '품절 사실 안내', status: 'ok' },
      { id: 3, label: '대체 메뉴 제안', status: 'wait' },
      { id: 4, label: '추가 비용 안내', status: 'wait' },
    ],
    customerLines: [
      '음... 그럼 어떤 메뉴 추천해주실 수 있어요?',
      '오 좋네요, 그걸로 할게요!',
    ],
    hints: {
      3: '대체 가능한 메뉴를 구체적으로 제안해보세요. "카라멜 라떼는 어떠세요?" 처럼요.',
      4: '가격 차이가 있다면 미리 안내해보세요.',
    },
  },
  ruleViolation: {
    tag: '매장 규칙 위반 손님',
    greeting: '안녕하세요! 오늘은 매장 규칙 위반 손님 상황을 연습해봐요.',
    messages: [
      { sender: 'customer', text: '저기 콘센트 좀 오래 써도 되죠? 노트북 작업 좀 하려고요.' },
      { sender: 'staff', text: '네, 다만 저희가 좌석당 이용시간을 안내드리고 있어요.' },
      { sender: 'customer', text: '아 그래요? 얼마나 되는데요?' },
    ],
    checklist: [
      { id: 1, label: '규칙 안내', status: 'ok' },
      { id: 2, label: '정중한 어투', status: 'ok' },
      { id: 3, label: '이용시간 구체적 안내', status: 'wait' },
      { id: 4, label: '대안 제시', status: 'wait' },
    ],
    customerLines: [
      '음 알겠어요. 근데 좀 아쉽네요.',
      '네 알겠습니다, 그럼 그 시간까지만 쓸게요.',
    ],
    hints: {
      3: '구체적인 이용 시간을 안내해보세요. "2시간 정도 이용 가능해요" 처럼요.',
      4: '아쉬워하는 손님에게 대안을 제시해보세요. "더 필요하시면 자리 여유 볼 때 다시 안내드릴게요" 처럼요.',
    },
  },
}

const DEFAULT_HINT = '체크리스트 항목을 모두 확인했어요. 마무리 인사를 건네보세요.'

function TrainingSession({ onHome, onFinish, scenario = 'delay' }) {
    const data = SCENARIOS[scenario] ?? SCENARIOS.delay

    const [messages, setMessages] = useState(data.messages) // 채팅창에 쌓이는 대화 목록
    const [inputValue, setInputValue] = useState('') // 입력창에 지금 타이핑 중인 글자,  사용자가 입력할 때마다 바뀌고, 전송하면 다시 비워짐.
    const [checklist, setChecklist] = useState(data.checklist) //오른쪽 체크리스트 4개 항목. 알바가 답을 보낼 때마다 wait 항목 하나가 ok로 바뀌는 식으로 갱신됨.
    const [turnIndex, setTurnIndex] = useState(0) // 현재 대화 턴 인덱스
    const [feedback, setFeedback] = useState(null)

    const passedCount = checklist.filter((item) => item.status === 'ok').length //checklist 배열에서 status가 'ok'인 것만 걸러내고, 몇 개인지 개수만 뽑음.
    const nextWaitItem = checklist.find((item) => item.status === 'wait') //checklist를 앞에서부터 훑다가 status가 'wait'인 첫 번째 항목을 찾아줌. 없으면 undefined. "지금 알바가 다음으로 채워야 할 기준이 뭔지"를 가리키는 값임.
    const hint = nextWaitItem ? data.hints[nextWaitItem.id] ?? DEFAULT_HINT : DEFAULT_HINT
    // nextWaitItem이 있으면 이 시나리오의 힌트 목록에서 찾아서 hint에 넣고, 없으면 DEFAULT_HINT를 넣음.
    // hint는 "AI 트레이너 힌트" 카드에 보여줄 문구
    // A ?? B 는 A가 null이나 undefined이면 B를 반환하고, 그렇지 않으면 A를 반환하는 연산자임.


    function handleSubmit(event) { //폼을 제출했을 때, 즉 "보내기" 버튼 눌렀을 때 실행될 함수
        event.preventDefault() // 폼 제출 시 페이지 새로고침 방지
        const trimmed = inputValue.trim() //입력값 앞뒤 공백을 지우고, 빈 문자열이면(아무것도 안 썼으면) 아무 것도 안 하고 함수를 끝냄.
        if (!trimmed) return

        //messages 배열에 새 메시지를 추가하는 부분

        // messages.push(...)처럼 원본을 직접 건드리지 않고, [...prev, 새항목]으로 기존 배열을 복사한 새 배열을 만들어서 교체함.
        // React는 "이전 값이랑 다른 새 객체/배열이 왔다"를 보고 화면을 다시 그리기 때문에, 원본을 직접 수정하면 변경을 못 알아채는 경우가 있음.
        // — 그래서 항상 이런 식으로 "새로 만들어서 교체"하는 습관을 들임.
        setMessages((prev) => [...prev, { sender: 'staff', text: trimmed }])
        setInputValue('') //입력창 비우기

        if (!nextWaitItem) {
            setFeedback({ type: 'coach', text: '이미 모든 기준을 충족했어요!' })
            return
        }

        if (trimmed.length < 5) {
            setFeedback({
                type: 'confused',
                text: `조금 더 자세히 답해보면 좋겠어요. "${nextWaitItem.label}"이(가) 아직 안 보여요.`,
            })
            return
        }

        //checklist 배열 전체를 .map()으로 훑으면서, nextWaitItem이랑 id가 같은 항목만 { ...item, status: 'ok' }(그 항목을 복사하되 status만 'ok'로 바꾼 새 객체)로 바꾸고,
        // 나머지는 그대로 둠.
        setChecklist((prev) =>
            prev.map((item) => (item.id === nextWaitItem.id ? { ...item, status: 'ok' } : item))
        )

        // 긍정 피드백 세팅. approve 마스코트가 뜨게.
        setFeedback({ type: 'approve', text: `✓ "${nextWaitItem.label}" 확인!` })

        // 고객 다음 대사 customerLines[turnIndex]를 가져와서, 0.6초 뒤에 messages 배열에 추가하고, turnIndex를 1 증가시킴.
        const nextLine = data.customerLines[turnIndex]
        if (nextLine) {
            setTimeout(() => {
                setMessages((prev) => [...prev, { sender: 'customer', text: nextLine }])
            }, 600)
            setTurnIndex((prev) => prev + 1)
        }
    }

    function handleEndTraining() {
        onFinish?.(checklist, data.tag)
    }

    return (
        <div className="session-page">
            <header className="session-nav">
                <div className="nav-left">
                    <button type="button" className="logo-word mono" onClick={onHome}>
                        albafit
                    </button>
                    <span className="session-meta mono">카페 훈련 세션 · {data.tag}</span>
                </div>
                <button className="end-btn" onClick={handleEndTraining}>훈련 종료</button>
            </header>

            <div className="session-wrap">
                <div className="greeting-banner glass">
                    <img src={mascotGreeting} alt="마스코트" />
                    <p>{data.greeting}</p>
                </div>


                <div className="progress-row">
                    <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${(turnIndex / data.customerLines.length) * 100}%` }}></div>
                    </div>
                    <span className="progress-label">{turnIndex + 1} / {data.customerLines.length} 상황</span>
                </div>

                <div className="session-grid">
                    <section className="chat-card glass">
                        <span className="scenario-tag">시나리오 · {data.tag}</span>

                        {messages.map((message, index) => (
                            <div key={index} className={`msg ${message.sender}`}>
                                {message.text}
                            </div>
                        ))}

                        {feedback && (
                            <div className={`feedback-bubble ${feedback.type}`}>
                                <img
                                    src={
                                        feedback.type === 'approve'
                                            ? mascotApprove
                                            : feedback.type === 'coach'
                                            ? mascotCoach
                                            : mascotConfused
                                    }
                                    alt="Feedback Mascot"
                                />
                                <p>{feedback.text}</p>
                            </div>
                        )}

                        <form className="input-bar" onSubmit={handleSubmit}>
                            <input
                                value={inputValue}
                                onChange={(event) => setInputValue(event.target.value)}
                                placeholder="답변을 입력하세요..."
                            />
                            <button type="submit">보내기</button>
                        </form>
                    </section>

                    <aside className="side-col">
                        <div className="mentor-card glass">
                            <img src={mascotCoach} alt="Mentor Mascot" />
                            <div className="hint-text">
                                <h4>AI 트레이너 힌트</h4>
                                <p>{hint}</p>
                            </div>
                        </div>

                        <div className="rule-check-list glass">
                            {checklist.map((item) => (
                                <div key={item.id} className="rc-item">
                                    <div className={`rc-dot ${item.status}`} />
                                    {item.label}
                                </div>
                            ))}
                        </div>

                        <div className="metric-mini glass">
                            <div className="metric-item">
                                <span className="metric-label">기준 충족</span>
                                <span className="metric-value">{passedCount} / {checklist.length}</span>
                            </div>
                            <div className="metric-item">
                                <span className="metric-label">경과 시간</span>
                                <span className="metric-value">01:48</span>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    )
}

export default TrainingSession;
