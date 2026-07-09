# design.md — 디자인 토큰 (CSS 변수)

> `albafit` 랜딩페이지 + 업종 선택 화면 목업에서 색·폰트·모서리·여백·카드 스타일을 추출해 CSS 변수로 정리한 문서.

## 토큰

```css
:root {
  /* 색 — 주색 */
  --color-primary: #3D6FE0;        /* 진한 블루, 버튼·선택 상태·강조 아이콘에 씀 */
  --color-primary-soft: #7FA6FF;   /* 연한 블루, 헤드라인 강조 단어·그라데이션 끝단에 씀 */
  --gradient-hero: radial-gradient(700px 500px at 15% -10%, rgba(64,110,220,0.32), transparent 60%),
                    radial-gradient(600px 500px at 90% 10%, rgba(90,150,255,0.16), transparent 55%),
                    radial-gradient(900px 700px at 50% 120%, rgba(40,60,110,0.38), transparent 60%);
                    /* 페이지 전체에 깔리는 은은한 메시 그라데이션, 배경색 위에 겹쳐 씀 */
  --gradient-primary: linear-gradient(90deg, #3D6FE0 0%, #7FA6FF 100%); /* 진행바 채움, 로고 마크 */

  /* 색 — 배경 */
  --color-bg: #F4F5F7;                        /* 페이지 기본 배경 (라이트) */
  --color-surface-glass: rgba(255,255,255,0.66); /* 글래스 카드 배경 */
  --color-surface-glass-border: rgba(20,23,28,0.07); /* 글래스 카드 테두리 */
  --color-surface-selected: rgba(61,111,224,0.14); /* 선택된 카드 배경 (primary 틴트) */
  --color-track: rgba(20,23,28,0.08);         /* 진행바 안 채워진 부분 */
  --blur-glass: 18px;                          /* backdrop-filter blur 값, 그림자 대신 이걸로 깊이감 표현 */

  /* 색 — 글자 */
  --color-text-heading: #14171C;   /* 섹션 제목, h1 */
  --color-text-body: #33363C;      /* 카드 안 본문, 강조 라벨 */
  --color-text-secondary: #5B616C; /* 서브 카피, 설명 문단 */
  --color-text-muted: #8A93A0;     /* 캡션, 스텝 표시(STEP 1/3) */
  --color-text-on-primary: #FFFFFF;/* 버튼 위 흰 글자 */
  --color-text-accent: #3D6FE0;    /* eyebrow, 강조 단어 */
  --color-footer-bg: #14171C;      /* 마무리 CTA 섹션만 다크로 대비를 준다 */

  /* 폰트 */
  --font-family-base: 'Pretendard', -apple-system, 'Apple SD Gothic Neo', sans-serif;
  --font-family-mono: 'IBM Plex Mono', monospace; /* 스텝 번호, 태그, 라벨류 전용 */
  --font-weight-bold: 800;         /* h1, 로고 워드마크 */
  --font-weight-semibold: 700;
  --font-weight-medium: 600;
  --font-weight-regular: 400;
  --font-size-hero: 2.75rem;       /* 44px, 히어로 h1 */
  --font-size-heading: 1.75rem;    /* 28px, 섹션 타이틀 */
  --font-size-subheading: 1.03rem; /* 16.5px, 카드 내 h3 */
  --font-size-body: 0.9rem;        /* 14.5px, 본문 */
  --font-size-caption: 0.75rem;    /* 12px, mono 라벨·eyebrow */

  /* 모서리 */
  --radius-card: 20px;    /* 글래스 카드 전부 (스텝 카드·프리뷰 카드·업종 카드) */
  --radius-control: 10px; /* 버튼, 인풋 */
  --radius-chip: 8px;     /* 피드백 태그 칩 */
  --radius-pill: 999px;   /* 배지, 진행바, 원형 체크 */

  /* 여백 */
  --space-card-padding: 24px;   /* 글래스 카드 안쪽 여백 */
  --space-card-gap: 14px;       /* 카드끼리 좌우 간격 (업종 선택 그리드) */
  --space-section-gap: 80px;    /* 큰 섹션 사이 간격 */
  --space-item-gap: 12px;       /* 리스트·태그 사이 간격 */

  /* 카드 스타일 */
  --shadow-card: none; /* 그림자를 쓰지 않고 backdrop-filter blur로만 깊이감을 준다 */

  /* 마스코트 */
  --mascot-size-inline: 18px;  /* 피드백 칩 등 텍스트 옆 인라인 아바타 */
  --mascot-size-badge: 26px;   /* 카드 상단바 등 작은 뱃지 */
  --mascot-size-feature: 110px;/* 섹션 헤더 옆 큰 일러스트 */
  --mascot-crop-position: 50% 15%; /* 원본이 전신 이미지라, object-position으로 얼굴만 크롭 */
}
```

## 참고

- 이 스타일은 밝은 배경(`--color-bg: #F4F5F7`) 위에 반투명 흰 유리 카드(`--color-surface-glass`)를 얹는 **라이트 글래스모피즘**이다. 처음엔 다크 배경 + 사진 히어로로 시작했는데, "매일 켜서 확인하는 관리 도구"에는 다크보다 라이트가 신뢰감·업무 툴 느낌에 더 맞아서 배경 톤만 뒤집었다. 글래스 카드라는 시그니처 구조는 그대로 유지했다. 예외로 맨 하단 CTA 섹션(`--color-footer-bg`)만 다크로 남겨서 마무리에 대비를 준다.
- 그림자는 기본적으로 안 쓴다. 카드의 입체감은 `border: 1px solid var(--color-surface-glass-border)` + `backdrop-filter: blur(18px)` 조합에서만 나온다. 단, 라이트 배경에서는 히어로처럼 가장 중요한 카드 하나에 한해 아주 옅은 그림자(`0 20px 60px rgba(20,30,60,0.08)`)를 예외적으로 허용한다 — 밝은 배경에서는 blur만으로 카드가 붕 떠 보이지 않기 때문. 나머지 카드는 그림자 없이 blur로만 처리한다.
- 파란색도 두 톤(연한 톤 `--color-primary-soft` / 진한 톤 `--color-primary`)으로 쓰인다. 헤드라인 강조 단어나 그라데이션 끝단엔 연한 톤을, 버튼·선택 상태처럼 실제 액션이 걸린 요소엔 진한 톤을 쓰는 식으로 구분돼 있다.
- 선택 가능한 카드(업종 선택 등)는 기본 상태에서 `--color-surface-glass`, 선택 시 배경이 `--color-surface-selected`(primary의 저채도 틴트)로 바뀌고 테두리만 `--color-primary`로 진해진다. 색을 통째로 바꾸지 않고 "틴트 + 테두리"로만 상태를 표현하는 게 이 스타일의 규칙이다.
- 모노스페이스 폰트(`--font-family-mono`)는 본문에는 쓰지 않고, STEP 표시·eyebrow·피드백 태그처럼 "시스템이 알려주는 짧은 정보"에만 제한적으로 쓴다. 이게 이 화면들의 시그니처 디테일이다.
- **마스코트(`mascot-*`)는 원본이 전신 이미지(2048x2048)라서, 작은 아바타로 쓸 때는 별도 크롭 파일을 만들지 않고 `object-fit: cover; object-position: 50% 15%;`로 얼굴만 잘라 보여준다.** 파일은 `/img/mascot-{greeting,approve,coach,confused}.png` 네 개뿐이고, 크기(18px 인라인 / 26px 뱃지 / 110px 일러스트)와 크롭 위치만 CSS로 다르게 준다.
- 마스코트 표정은 문맥에 맞게 고정해서 쓴다: `greeting`은 히어로·첫 인사, `approve`는 긍정 피드백(초록 계열) 옆, `confused`는 경고·주의 피드백(주황 계열) 옆, `coach`는 설명형 섹션 헤더 옆. 표정과 피드백 톤이 어긋나면(예: 경고 문구 옆에 approve) 안 된다.