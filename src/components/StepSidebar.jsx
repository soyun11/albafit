import './StepSidebar.css'

const STEPS = [
  { n: 1, title: '매장업종선택 · 매뉴얼입력', desc: '매장 업종을 고르고 매뉴얼을 입력해요' },
  { n: 2, title: '규칙확인', desc: 'AI가 만든 규정을 확인·수정해요' },
  { n: 3, title: '루브릭승인', desc: 'AI가 만든 기준을 승인해요' },
]

function StepSidebar({ current }) {
  return (
    <aside className="step-sidebar">
      {STEPS.map((step) => {
        const isDone = step.n < current
        const isCurrent = step.n === current

        return (
          <div
            key={step.n}
            className={`step-item ${isCurrent ? 'current' : ''} ${isDone ? 'done' : ''}`}
          >
            <div className="step-number mono">{isDone ? '✓' : step.n}</div>
            <div>
              <div className="step-title">{step.title}</div>
              <div className="step-desc">{step.desc}</div>
            </div>
          </div>
        )
      })}
    </aside>
  )
}

export default StepSidebar
