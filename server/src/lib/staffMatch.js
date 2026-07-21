// 이 세션이 이 알바 계정 것인지 판단한다. staffId가 있으면(이 컬럼이 생긴 이후 세션) 그 값만
// 신뢰하고, 없으면(레거시 row) staffLabel 문자열과 이름을 비교하는 것으로만 폴백한다 — 폴백은
// 동명이인을 구분 못 하는 한계가 있지만, staffId 도입 전 과거 데이터는 그 방법밖에 없다.
export function belongsToStaff(session, user) {
  if (session.staffId) return session.staffId === user.id
  if (!session.staffLabel) return false
  return session.staffLabel === user.name
}
