# dashboard-staff-consolidation.md — 알바 목록·초대를 대시보드로 통합

> `docs/rubric-reuse.md`와 같은 방식으로 기록한다. 근거: 사용자가 상단바 명칭을 검토하다 나온 정보 구조 재배치, 2026-07-22.

## 왜 고쳤나

상단바 명칭을 다시 보다가, "알바 관리"(`StaffInvite.jsx`)가 실제로는 계정 생성 폼 + 이번 방문에서 만든 계정만 보여주는 화면이라 "관리"라는 이름이 실제보다 과장돼 있다는 걸 발견했다. 진짜 "알바 목록"(이름·진행률·점수·상태)은 "리포트"(`ReportList.jsx`) 화면에 있었다. 사장님 입장에서는 대시보드 → 알바 관리 → 리포트 세 화면에 알바 관련 정보가 흩어져 있던 셈이다. 사용자가 "대시보드에서 실제 알바를 관리하는 게 맞을 것 같다"고 확정해, 목록 표 + 초대 폼을 전부 대시보드로 합치기로 했다.

## 결정

| 논점 | 결정 | 이유 |
|---|---|---|
| 통합 범위 | 알바 목록 표(이름·진행률·점수·상태, 클릭→상세 리포트) + "+ 새 알바 초대" 버튼(누르면 기존 초대 폼 화면으로) 둘 다 대시보드로. "정정 이력 모아보기" 링크도 같이 옮김 | 사용자가 "알바 목록 표 + 초대 폼 모두 대시보드로"를 확정 선택. |
| nav 변화 | `OWNER_LINKS`에서 `리포트`·`알바 관리` 링크 제거, `대시보드`·`기준 관리`만 남김. 개별 알바 상세 리포트·초대 폼·캘리브레이션·정정이력 화면 자체는 그대로 존재하되(화면 키 유지), nav 링크가 아니라 대시보드에서 클릭해 들어가는 하위 화면이 된다 | 목록이 사라지는 게 아니라 진입 경로만 대시보드로 모이는 것 — 각 화면 자체(계정 생성 폼, 개별 리포트, 캘리브레이션)는 코드 변경 없이 그대로 재사용. |
| `ReportList.jsx` 처리 | 컴포넌트 파일 삭제(더 이상 어디서도 안 씀), `ReportList.css`는 유지(`CorrectionHistory.jsx`가 계속 씀) | 안 쓰는 코드는 완전히 지운다는 원칙. CSS는 다른 화면이 의존하고 있어 분리해서 판단. |
| 하위 화면들의 `current` prop | `TurnCalibrationReview.jsx`/`CorrectionHistory.jsx`/`FeedbackReport.jsx`(사장님 뷰)의 `current="reports"`를 `current="dashboard"`로 변경 | "리포트" nav 링크 자체가 없어졌으니, 이 하위 화면들에 있을 때는 "대시보드"가 활성 표시되는 게 맞다(거기서 들어왔으니까). |

## 다음 단계

1. ~~설계 문서화 (이 문서)~~ — 완료
2. `OwnerDashboard.jsx` — `staff` 목록도 fetch해서 표로 렌더링(ReportList.jsx 표 그대로 재사용), "+ 새 알바 초대"·"정정 이력 모아보기" 진입점 추가, `onViewReport` prop 연결
3. `OwnerDashboard.css` — 표·상태칩·초대 버튼 스타일 추가(ReportList.css 스타일을 `.dashboard-page` 접두사로 옮겨옴)
4. `AppNav.jsx` — `OWNER_LINKS`에서 `reports`/`invite` 제거
5. `IndustrySelect.jsx` — `NO_STORE_YET` 배열에서 제거된 링크 정리
6. `src/lib/screenAccess.js` — `OWNER_SCREENS`에서 `'reports'` 제거(`invite`는 화면 자체는 남으므로 유지)
7. `App.jsx` — `ReportList` import·`'reports'` 렌더 블록 제거, `OwnerDashboard`에 `onViewReport` 연결
8. `TurnCalibrationReview.jsx`/`CorrectionHistory.jsx`/`FeedbackReport.jsx`의 `current="reports"` → `"dashboard"`
9. `ReportList.jsx` 삭제
10. `npm test`(루트) + `npm run lint` + `npm run build`
11. 브라우저로 확인: 대시보드에 알바 목록·초대 버튼 정상 표시, 클릭 시 상세 리포트/초대 폼 진입, nav에 리포트·알바 관리 링크 사라짐, 온보딩(매장 미설정) 상태에서 disabledKeys 정상 동작

## 구현·검증

### 구현
- `OwnerDashboard.jsx` — `/me/staff-report`에서 이미 내려주던 `staff` 배열을 렌더링(표), "정정 이력 모아보기"·"+ 새 알바 초대" 진입점 추가, `onViewReport` prop 연결.
- `OwnerDashboard.css` — `ReportList.css`의 표·상태칩·링크 스타일을 `.dashboard-page` 접두사로 옮겨옴, 안 쓰는 `.report-link-card`/`.report-link-sub` 삭제.
- `AppNav.jsx` — `OWNER_LINKS`를 `대시보드`/`기준 관리` 2개로 축소.
- `IndustrySelect.jsx` — `NO_STORE_YET` 배열에서 제거된 링크 정리.
- `screenAccess.js` — `OWNER_SCREENS`에서 `'reports'` 제거(`invite`는 화면 자체가 남아있어 유지).
- `App.jsx` — `ReportList` import·`'reports'` 렌더 블록 제거, `OwnerDashboard`에 `onViewReport` 연결.
- `TurnCalibrationReview.jsx`/`CorrectionHistory.jsx`/`FeedbackReport.jsx`의 `current="reports"` → `"dashboard"`.
- `ReportList.jsx` 삭제(더 이상 어디서도 안 씀), `ReportList.css`는 `CorrectionHistory.jsx`가 계속 써서 유지.
- 루트 테스트 12개 + lint + build 통과.

### 브라우저 확인 (`claude-in-chrome`, 기존 사장님 테스트 계정)
- nav에 "리포트"·"알바 관리" 링크가 사라지고 "대시보드"·"기준 관리"만 남음.
- 대시보드에 알바 목록 표(검증알바, 2/3, 50점, 훈련중)가 정상 표시되고, "정정 이력 모아보기"·"+ 새 알바 초대" 둘 다 정상 진입.
- 알바 행 클릭 → 개별 상세 리포트로 이동, nav의 "대시보드"가 활성 표시로 정확히 유지됨(예전엔 "리포트"가 활성 표시됐는데 그 링크 자체가 없어졌으므로 대시보드로 대체).
- 콘솔 에러 없음.
