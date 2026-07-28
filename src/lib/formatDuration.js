// 초 단위 총 훈련 시간을 "M분 N초" 형태로 사람이 읽기 좋게 바꾼다. 서버 durationSeconds가 null이면
// (세션 미완료) 호출부에서 그대로 null을 받아 '—' 같은 자리표시자를 직접 그린다.
export function formatDuration(totalSeconds) {
  if (totalSeconds == null) return null
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds}초`
  return `${minutes}분 ${seconds}초`
}
