import './StepSidebar.css'

const STEPS = [
  { n: 1, title: '매장업종선택 · 매뉴얼입력', desc: '매장 업종을 고르고 매뉴얼을 입력해요' },
  { n: 2, title: '규칙확인', desc: 'AI가 만든 규정을 확인·수정해요' },
  { n: 3, title: '루브릭승인', desc: 'AI가 만든 기준을 승인해요' },
]

// onStepClick이 있으면(=재설정 흐름 중) 각 단계를 눌러서 자유롭게 오갈 수 있다.
// 없으면(=최초 온보딩) 지금 어디까지 왔는지 보여주기만 하는 정적 표시로 남는다 — 아직 매장도
// 없는 단계에서 뒤죽박죽 건너뛰면 오히려 헷갈리기 때문.
function StepSidebar({ current, onStepClick }) {
  const clickable = Boolean(onStepClick)
  const Tag = clickable ? 'button' : 'div'

  return (
    <aside className="step-sidebar">
      {STEPS.map((step) => {
        const isDone = step.n < current
        const isCurrent = step.n === current

        return (
          <Tag
            key={step.n}
            type={clickable ? 'button' : undefined}
            className={`step-item ${isCurrent ? 'current' : ''} ${isDone ? 'done' : ''} ${clickable ? 'clickable' : ''}`}
            onClick={clickable ? () => onStepClick(step.n) : undefined}
          >
            <div className="step-number mono">{isDone ? '✓' : step.n}</div>
            <div>
              <div className="step-title">{step.title}</div>
              <div className="step-desc">{step.desc}</div>
            </div>
          </Tag>
        )
      })}
    </aside>
  )
}

export default StepSidebar
