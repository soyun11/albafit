---
name: albafit-design
description: albafit(매장 맞춤 알바 훈련 서비스) 프로젝트의 디자인 시스템. 새 화면·컴포넌트를 만들거나 기존 화면 스타일을 수정할 때 이 스킬을 먼저 읽는다. 라이트 글래스모피즘 톤, 컬러/폰트/모서리/여백 토큰, 마스코트 캐릭터 사용 규칙을 담고 있다.
---

# albafit 디자인 시스템

## 언제 쓰나
- 새 페이지, 새 컴포넌트를 만들 때
- 기존 화면의 색·폰트·여백을 수정할 때
- 마스코트 캐릭터(`/img/mascot-*.png`)를 화면 어딘가에 넣을 때

이 스킬을 읽었으면 `design.md`의 CSS 변수를 그대로 가져다 쓴다. 새로운 hex 값을 임의로 만들지 않는다.

## 핵심 규칙 요약
1. **라이트 글래스모피즘**: 배경은 `--color-bg`(연한 그레이), 카드는 반투명 흰 유리(`--color-surface-glass`) + `backdrop-filter: blur(18px)`. 그림자는 원칙적으로 안 쓰고, 정말 강조해야 하는 카드 하나 정도에만 예외로 옅은 그림자를 허용한다.
2. **색은 두 톤만**: 진한 블루(`--color-primary`)는 버튼·선택 상태처럼 실제 액션에, 연한 블루(`--color-primary-soft`)는 헤드라인 강조·장식용에만 쓴다.
3. **모노스페이스는 제한적으로**: `--font-family-mono`는 본문에 쓰지 않는다. STEP 표시, eyebrow, 피드백 태그처럼 "시스템이 알려주는 짧은 정보"에만 쓴다.
4. **선택 상태 표현**: 카드가 선택됐을 때 배경색을 통째로 바꾸지 않는다. `--color-surface-selected`(연한 틴트) + 테두리만 `--color-primary`로 바꾼다.
5. **마스코트 사용**: 아래 "마스코트" 섹션 규칙을 반드시 따른다. 표정과 문맥이 어긋나면 안 된다.

전체 토큰 목록과 이유는 `design.md`를 참고한다.

## 마스코트
파일은 `/public/img/` 아래 4개뿐이다. 전부 2048x2048 전신 이미지라, 작게 쓸 땐 별도 크롭 파일을 만들지 않고 CSS로 얼굴만 잘라 보여준다.

```
/img/mascot-greeting.png   기본 인사 포즈 — 히어로, 첫 방문 화면
/img/mascot-approve.png    승인/칭찬 포즈 — 긍정 피드백(초록 계열) 옆
/img/mascot-coach.png      코칭/생각 포즈 — 설명형 섹션 헤더, 중립 피드백 옆
/img/mascot-confused.png   헷갈림 포즈 — 경고/주의 피드백(주황 계열) 옆
```

작게 쓸 때 공통 스타일:
```css
object-fit: cover;
object-position: 50% 15%; /* 얼굴만 보이게 크롭 */
border-radius: 50%;
```

크기는 용도에 따라 `--mascot-size-inline`(18px, 텍스트 옆) / `--mascot-size-badge`(26px, 카드 상단바) / `--mascot-size-feature`(110px, 섹션 헤더 옆 일러스트) 중에서 고른다. 새로운 크기가 필요하면 이 세 값 사이에서 고르고, 꼭 필요할 때만 새 값을 추가한다.

**표정 매칭 규칙** (이거 어기면 안 됨):
- 잘한 응대, 정답, 성공 → `mascot-approve`
- 개선 팁, 설명, 중립적인 안내 → `mascot-coach`
- 틀린 응대, 경고, 주의 필요 → `mascot-confused`
- approve 표정 옆에 경고 문구를 붙이거나, confused 표정 옆에 칭찬 문구를 붙이지 않는다.

## 참고 파일
- `design.md` — 전체 CSS 변수 토큰 (색·폰트·모서리·여백·마스코트 크기)
- `landing_light.html` — 최신 기준 구현 예시 (헤더, 히어로, 신뢰 지표, FIT 섹션, Before/After, 마스코트 적용 방식)

새 화면을 만들 때는 `landing_light.html`의 `.nav`, `.glass`, `.badge`, `.btn-primary` 같은 기존 클래스/구조를 재사용하고, 필요할 때만 새 클래스를 추가한다.