import { useEffect, useState } from 'react'
import LandingPage from './components/LandingPage'
import Login from './components/Login'
import Signup from './components/Signup'
import ChangePassword from './components/ChangePassword'
import IndustrySelect from './components/IndustrySelect'
import RulesInput from './components/RulesInput'
import RubricApproval from './components/RubricApproval'
import StaffInvite from './components/StaffInvite'
import ScenarioSelect from './components/ScenarioSelect'
import MyProgress from './components/MyProgress'
import TrainingSession from './components/TrainingSession'
import FeedbackReport from './components/FeedbackReport'
import TurnCalibrationReview from './components/TurnCalibrationReview'
import CorrectionHistory from './components/CorrectionHistory'
import OwnerDashboard from './components/OwnerDashboard'
import ReportList from './components/ReportList'
import VerifyEmail from './components/VerifyEmail'
import GuestTry from './components/GuestTry'
import {
  apiFetch,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setAuthExpiredHandler,
} from './lib/api'
import { isScreenAllowed, landingScreenFor } from './lib/screenAccess'

// 라우터 없는 SPA라 인증 메일 링크(/verify-email?token=...)로 들어왔는지는 모듈이 로드되는 시점에
// 딱 한 번만 URL을 확인해서 판단한다(컴포넌트 안에서 하면 StrictMode가 두 번 실행시켜 주소창을
// 되돌리는 부수효과가 꼬일 수 있음). 토큰을 꺼낸 뒤 바로 주소창을 "/"로 되돌려서, 나중에 새로고침해도
// 이 화면으로 다시 안 오게 한다.
function readVerifyEmailToken() {
  if (window.location.pathname !== '/verify-email') return null
  const token = new URLSearchParams(window.location.search).get('token')
  window.history.replaceState({}, '', '/')
  return token
}

const initialVerifyEmailToken = readVerifyEmailToken()

function App() {
  const [screen, setScreen] = useState(initialVerifyEmailToken ? 'verifyEmail' : 'landing')
  const [user, setUser] = useState(null)
  // 업종선택 화면의 매뉴얼 입력을 Gemini가 규칙 단위로 쪼갠 결과({title, content}[]) — 실패하거나
  // 매뉴얼을 안 썼으면 빈 배열이고, 그러면 규칙확인 화면은 기본 예시 카드만 보여준다.
  const [manualRules, setManualRules] = useState([])
  const [rubrics, setRubrics] = useState([])
  const [selectedScenario, setSelectedScenario] = useState(null)
  const [trainingResult, setTrainingResult] = useState(null)
  const [reportStaffName, setReportStaffName] = useState(null)
  const [reportSessionId, setReportSessionId] = useState(null)
  // "기준 재설정" 흐름 중인지 — true면 industry/rules/rubricManage 화면이 StepSidebar를 같이 보여주고
  // step을 눌러 자유롭게 오갈 수 있다. resetRawText는 그 흐름의 step2(규칙)를 저장된 원문으로 채우는 값,
  // resetItems는 카드별 원래 라벨을 그대로 복원하기 위한 값(과거 데이터엔 없어서 null일 수 있음).
  const [resetMode, setResetMode] = useState(false)
  const [resetRawText, setResetRawText] = useState('')
  const [resetItems, setResetItems] = useState(null)

  // screen이 지금 로그인 상태(user)로 들어갈 수 없는 화면이면(역할이 안 맞거나 로그인이 안 됨),
  // 실제로 렌더링할 화면은 그 사용자의 홈 화면으로 대체한다 — screen state 자체는 안 건드리고
  // 렌더링 직전에만 바꿔치기하므로, 어떤 경로로 setScreen이 호출되든(AppNav든, 나중에 추가될
  // 다른 진입점이든) 이 한 곳만 지나면 잘못된 화면이 걸러진다.
  const effectiveScreen = isScreenAllowed(screen, user) ? screen : landingScreenFor(user)

  // 라우터 없는 SPA라 화면(screen)이 바뀌어도 브라우저 스크롤 위치는 그대로 남는다 — 이전 화면을
  // 스크롤해서 내려간 상태로 nav를 눌러 넘어가면, 새 화면의 상단바가 뷰포트 밖으로 밀려 안 보이는
  // 문제가 있어서 화면 전환마다 맨 위로 되돌린다.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [effectiveScreen])

  // 앱이 처음 뜰 때, 이전에 로그인해서 저장해둔 토큰이 있으면 그걸로 로그인 상태를 복원한다.
  // 액세스 토큰이 만료돼 있어도 apiFetch가 리프레시 토큰으로 조용히 재발급받아 이어준다.
  useEffect(() => {
    setAuthExpiredHandler(() => {
      setUser(null)
      setScreen('login')
    })

    if (!getAccessToken()) return
    apiFetch('/api/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => clearTokens())
  }, [])

  function goHome() {
    setResetMode(false)
    setScreen('landing')
  }

  function handleStart() {
    setScreen(landingScreenFor(user))
  }

  function handleLoginSuccess(loggedInUser) {
    setUser(loggedInUser)
    setScreen(landingScreenFor(loggedInUser))
  }

  function handleSignupSuccess(newUser) {
    setUser(newUser)
    setScreen(landingScreenFor(newUser))
  }

  // 프론트에서 토큰만 지우는 게 아니라 서버에도 리프레시 토큰을 무효화시켜서, 그 토큰이 새어나가도
  // 더 이상 재발급에 못 쓰이게 한다.
  async function handleLogout() {
    const refreshToken = getRefreshToken()
    if (refreshToken) {
      apiFetch('/api/auth/logout', { method: 'POST', auth: false, body: { refreshToken } }).catch(() => {})
    }
    clearTokens()
    setUser(null)
    setScreen('landing')
  }

  // 매뉴얼 텍스트를 Gemini로 규칙 단위 카드({title, content}[])로 나눠서 manualRules에 저장.
  // 업종선택(최초 온보딩)과 재설정 흐름의 STEP1 둘 다 이 함수를 그대로 재사용한다.
  async function splitAndSetManualRules(text) {
    const trimmedManual = (text ?? '').trim()
    if (!trimmedManual) {
      setManualRules([])
      return
    }
    try {
      const data = await apiFetch('/api/stores/manual-split', {
        method: 'POST',
        body: { manualText: trimmedManual },
      })
      setManualRules(data.rules)
    } catch {
      // 분리에 실패해도 흐름 자체를 막지는 않는다 — 카드 없이 넘어가고 사장님이 직접 추가하면 된다.
      setManualRules([])
    }
  }

  // 업종선택 화면에서 "다음"을 누르는 시점에 실제로 매장을 만든다 — 그래야 이후 알바 계정
  // 생성처럼 storeId가 필요한 동작들이 mock이 아니라 진짜 데이터로 동작한다.
  async function handleIndustryNext(industryKey, text) {
    const { store, accessToken } = await apiFetch('/api/stores', {
      method: 'POST',
      body: { industry: industryKey },
    })
    setAccessToken(accessToken)
    setUser((prev) => ({
      ...prev,
      storeId: store.id,
      store: { id: store.id, linkKey: store.linkKey, name: store.name, industry: store.industry },
    }))
    await splitAndSetManualRules(text)
    setScreen('rules')
  }

  // 재설정 흐름의 STEP1 "다음" — 매장은 이미 있으니 새로 만들지 않고, 새로 적은 매뉴얼만 분리해서
  // step2에 저장된 규칙과 함께 보여준다.
  async function handleResetIndustryNext(_industryKey, text) {
    await splitAndSetManualRules(text)
    setScreen('rules')
  }

  function handleScenarioNext(scenarioId) {
    setSelectedScenario(scenarioId)
    setScreen('training')
  }

  function handleTrainingFinish(checklist, scenarioTag, durationMinutes, heartsRemaining, maxHearts) {
    setTrainingResult({
      checklist,
      scenarioTag,
      durationMinutes,
      industry: user?.store?.industry,
      heartsRemaining,
      maxHearts,
    })
    setReportStaffName(null)
    setReportSessionId(null)
    setScreen('feedback')
  }

  // 리포트 목록에서 알바를 클릭했을 때 — 그 알바의 가장 최근 완료 세션을 실제로 불러온다.
  // (예전엔 항상 FeedbackReport의 기본 mock을 보여줬다.)
  async function handleViewReport(staff) {
    try {
      const data = await apiFetch(`/api/stores/me/staff/${staff.id}/latest-report`)
      setTrainingResult({
        checklist: data.checklist,
        scenarioTag: data.scenarioTitle,
        durationMinutes: data.durationMinutes,
        industry: data.industry,
        heartsRemaining: data.heartsRemaining,
        maxHearts: data.maxHearts,
      })
      setReportStaffName(data.staffName)
      setReportSessionId(data.sessionId)
      setScreen('feedback')
    } catch (err) {
      alert(err.message)
    }
  }

  // 대시보드 "기준 관리"에서 들어올 때 — 온보딩 흐름과 달리 RulesInput이 만들어준 rubrics가 없으니
  // 서버에서 다시 불러온다. AppNav 링크로 들어온 "그냥 보기"라서 재설정 흐름은 항상 끈다.
  async function handleManageRubrics() {
    try {
      const data = await apiFetch('/api/stores/me/rubrics')
      setRubrics(data.rubrics)
      setResetMode(false)
      setScreen('rubricManage')
    } catch (err) {
      alert(err.message)
    }
  }

  // "기준 재설정" 버튼 — 그동안 저장된 규칙 원문을 불러와서 step2(규칙 편집) 화면으로 보낸다.
  async function handleResetRules() {
    try {
      const data = await apiFetch('/api/stores/me/rules')
      setResetRawText(data.rawText)
      setResetItems(data.items)
      // 이전 온보딩(또는 이전 재설정 시도)에서 남아있던 매뉴얼 분리 결과가 있으면 지운다 — 재설정을
      // 새로 시작할 땐 STEP1에서 새로 입력한 것만 반영해야 한다.
      setManualRules([])
      setResetMode(true)
      setScreen('rules')
    } catch (err) {
      alert(err.message)
    }
  }

  // 재설정 흐름 중 StepSidebar의 step3(루브릭)을 눌렀을 때 — 다시 제출 안 해도 지금 저장된
  // 루브릭을 그대로 보여준다. handleManageRubrics와 달리 resetMode를 켠 채로 유지한다.
  async function handleResetStep3() {
    try {
      const data = await apiFetch('/api/stores/me/rubrics')
      setRubrics(data.rubrics)
      setResetMode(true)
      setScreen('rubricManage')
    } catch (err) {
      alert(err.message)
    }
  }

  function handleResetStepClick(step) {
    if (step === 1) return setScreen('industry')
    if (step === 2) return setScreen('rules')
    return handleResetStep3()
  }

  // 로그인된 화면들(AppNav)이 공유하는 이동 핸들러. 화면마다 onHome/onInvite처럼 따로 콜백을
  // 안 만들고 이 하나로 통일한다.
  function handleNavigate(key) {
    if (key === 'home') return goHome()
    if (key === 'rubricManage') return handleManageRubrics()
    setScreen(key)
  }

  if (effectiveScreen === 'verifyEmail') {
    return <VerifyEmail onHome={goHome} token={initialVerifyEmailToken} />
  }
  if (effectiveScreen === 'login') {
    return <Login onHome={goHome} onSignup={() => setScreen('signup')} onLoginSuccess={handleLoginSuccess} />
  }
  if (effectiveScreen === 'signup') {
    return <Signup onHome={goHome} onLogin={() => setScreen('login')} onSignupSuccess={handleSignupSuccess} />
  }
  if (effectiveScreen === 'changePassword') {
    return (
      <ChangePassword
        onBack={() => setScreen(landingScreenFor(user))}
        role={user?.role}
        onNavigate={handleNavigate}
        onChangePassword={() => setScreen('changePassword')}
        onLogout={handleLogout}
      />
    )
  }

  if (effectiveScreen === 'industry') {
    return (
      <IndustrySelect
        onBack={resetMode ? handleManageRubrics : goHome}
        onNext={resetMode ? handleResetIndustryNext : handleIndustryNext}
        onStepClick={resetMode ? handleResetStepClick : undefined}
        onNavigate={handleNavigate}
        onChangePassword={() => setScreen('changePassword')}
        onLogout={handleLogout}
        resetMode={resetMode}
        user={user}
      />
    )
  }
  if (effectiveScreen === 'rules') {
    return (
      <RulesInput
        onBack={() => setScreen('industry')}
        onNext={(newRubrics) => {
          setRubrics(newRubrics)
          setScreen(resetMode ? 'rubricManage' : 'rubric')
        }}
        onStepClick={resetMode ? handleResetStepClick : undefined}
        onNavigate={handleNavigate}
        onChangePassword={() => setScreen('changePassword')}
        onLogout={handleLogout}
        manualRules={manualRules}
        linkKey={user?.store?.linkKey}
        resetMode={resetMode}
        initialRawText={resetRawText}
        initialItems={resetItems}
        user={user}
      />
    )
  }
  if (effectiveScreen === 'rubric') {
    return (
      <RubricApproval
        onHome={goHome}
        onBack={() => setScreen('rules')}
        onInvite={() => setScreen('invite')}
        onNavigate={handleNavigate}
        onChangePassword={() => setScreen('changePassword')}
        onLogout={handleLogout}
        rubrics={rubrics}
        onRubricsChange={setRubrics}
      />
    )
  }
  if (effectiveScreen === 'rubricManage') {
    return (
      <RubricApproval
        onBack={() => setScreen('dashboard')}
        rubrics={rubrics}
        onRubricsChange={setRubrics}
        onDone={() => {
          setResetMode(false)
          setScreen('dashboard')
        }}
        showSteps={resetMode}
        onStepClick={handleResetStepClick}
        onResetRules={handleResetRules}
        onNavigate={handleNavigate}
        onChangePassword={() => setScreen('changePassword')}
        onLogout={handleLogout}
      />
    )
  }
  if (effectiveScreen === 'invite') {
    return (
      <StaffInvite
        onNavigate={handleNavigate}
        onChangePassword={() => setScreen('changePassword')}
        onLogout={handleLogout}
      />
    )
  }
  if (effectiveScreen === 'reports') {
    return (
      <ReportList
        onNavigate={handleNavigate}
        onChangePassword={() => setScreen('changePassword')}
        onLogout={handleLogout}
        onViewReport={handleViewReport}
      />
    )
  }
  if (effectiveScreen === 'scenario') {
    return (
      <ScenarioSelect
        onNext={handleScenarioNext}
        onNavigate={handleNavigate}
        onChangePassword={() => setScreen('changePassword')}
        onLogout={handleLogout}
      />
    )
  }
  if (effectiveScreen === 'myProgress') {
    return (
      <MyProgress onNavigate={handleNavigate} onChangePassword={() => setScreen('changePassword')} onLogout={handleLogout} />
    )
  }
  if (effectiveScreen === 'training') {
    return (
      <TrainingSession
        onNavigate={handleNavigate}
        onChangePassword={() => setScreen('changePassword')}
        onLogout={handleLogout}
        onFinish={handleTrainingFinish}
        scenario={selectedScenario}
        staffLabel={user?.name}
      />
    )
  }
  if (effectiveScreen === 'feedback') {
    return (
      <FeedbackReport
        onRetry={() => setScreen('scenario')}
        checklist={trainingResult?.checklist}
        scenarioTag={trainingResult?.scenarioTag}
        durationMinutes={trainingResult?.durationMinutes}
        industry={trainingResult?.industry}
        heartsRemaining={trainingResult?.heartsRemaining}
        maxHearts={trainingResult?.maxHearts}
        staffName={reportStaffName ?? '나'}
        onCalibrate={reportStaffName ? () => setScreen('calibration') : undefined}
        role={user?.role}
        onNavigate={handleNavigate}
        onChangePassword={() => setScreen('changePassword')}
        onLogout={handleLogout}
      />
    )
  }
  if (effectiveScreen === 'calibration') {
    return (
      <TurnCalibrationReview
        sessionId={reportSessionId}
        staffName={reportStaffName}
        onBack={() => setScreen('feedback')}
        onNavigate={handleNavigate}
        onChangePassword={() => setScreen('changePassword')}
        onLogout={handleLogout}
      />
    )
  }
  if (effectiveScreen === 'correctionHistory') {
    return (
      <CorrectionHistory
        onNavigate={handleNavigate}
        onChangePassword={() => setScreen('changePassword')}
        onLogout={handleLogout}
      />
    )
  }
  if (effectiveScreen === 'dashboard') {
    return (
      <OwnerDashboard
        onNavigate={handleNavigate}
        onChangePassword={() => setScreen('changePassword')}
        onLogout={handleLogout}
        user={user}
      />
    )
  }

  if (effectiveScreen === 'guestTry') {
    return <GuestTry onNavigate={handleNavigate} />
  }

  return (
    <LandingPage
      onStart={handleStart}
      onTry={() => setScreen('guestTry')}
      onLogin={() => setScreen('login')}
      onSignup={() => setScreen('signup')}
      onLogout={handleLogout}
      user={user}
    />
  )
}

export default App
