import { useState } from 'react'
import LandingPage from './components/LandingPage'
import Home from './components/Home'
import IndustrySelect from './components/IndustrySelect'
import RulesInput from './components/RulesInput'
import RubricApproval from './components/RubricApproval'
import StaffInvite from './components/StaffInvite'
import ScenarioSelect from './components/ScenarioSelect'
import TrainingSession from './components/TrainingSession'
import FeedbackReport from './components/FeedbackReport'
import OwnerDashboard from './components/OwnerDashboard'

function App() {
  const [screen, setScreen] = useState('landing')
  const [manualText, setManualText] = useState('')
  const [selectedScenario, setSelectedScenario] = useState('delay')
  const [trainingResult, setTrainingResult] = useState(null)
  const [reportStaffName, setReportStaffName] = useState(null)

  function goHome() {
    setScreen('landing')
  }

  function handleIndustryNext(text) {
    setManualText(text)
    setScreen('rules')
  }

  function handleScenarioNext(scenarioKey) {
    setSelectedScenario(scenarioKey)
    setScreen('training')
  }

  function handleTrainingFinish(checklist, scenarioTag) {
    setTrainingResult({ checklist, scenarioTag })
    setReportStaffName(null)
    setScreen('feedback')
  }

  function handleViewReport(staffName) {
    setTrainingResult(null)
    setReportStaffName(staffName)
    setScreen('feedback')
  }

  if (screen === 'industry') {
    return <IndustrySelect onHome={goHome} onBack={goHome} onNext={handleIndustryNext} />
  }
  if (screen === 'rules') {
    return (
      <RulesInput
        onHome={goHome}
        onBack={() => setScreen('industry')}
        onNext={() => setScreen('rubric')}
        manualText={manualText}
      />
    )
  }
  if (screen === 'rubric') {
    return (
      <RubricApproval
        onHome={goHome}
        onBack={() => setScreen('rules')}
        onInvite={() => setScreen('invite')}
      />
    )
  }
  if (screen === 'invite') {
    return <StaffInvite onHome={goHome} onDashboard={() => setScreen('dashboard')} />
  }
  if (screen === 'scenario') {
    return <ScenarioSelect onHome={goHome} onNext={handleScenarioNext} />
  }
  if (screen === 'training') {
    return (
      <TrainingSession onHome={goHome} onFinish={handleTrainingFinish} scenario={selectedScenario} />
    )
  }
  if (screen === 'feedback') {
    return (
      <FeedbackReport
        onHome={goHome}
        onRetry={() => setScreen('scenario')}
        checklist={trainingResult?.checklist}
        scenarioTag={trainingResult?.scenarioTag}
        staffName={reportStaffName ?? '나'}
      />
    )
  }
  if (screen === 'dashboard') {
    return (
      <OwnerDashboard
        onHome={goHome}
        onInvite={() => setScreen('invite')}
        onViewReport={handleViewReport}
      />
    )
  }

  if (screen === 'menu') {
    return <Home onNavigate={setScreen} onBack={goHome} />
  }

  return <LandingPage onStart={() => setScreen('industry')} onMenu={() => setScreen('menu')} />
}

export default App
