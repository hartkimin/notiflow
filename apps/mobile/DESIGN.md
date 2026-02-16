# MedNoti Design System

> TWS (투어스) iOS Glassmorphism 스타일 기반의 알림 관리 앱 디자인 시스템.
> 이 문서는 모든 UI 변경 시 디자인 일관성을 유지하기 위한 단일 진실 공급원(Single Source of Truth)입니다.

---

## 1. 시각적 테마 및 분위기

**핵심 아이덴티티**: iOS의 깔끔한 글래스모피즘(Glassmorphism)과 하늘색 중심의 차분한 톤.
스칸디나비안 미니멀리즘에서 영감을 받은 넓은 여백, 부드러운 모서리, 반투명 레이어가 특징.

**분위기 키워드**: 신뢰감 있는, 세련된, 깔끔한, 차분한, 전문적이면서 친근한

**디자인 원칙**:
- 여백을 충분히 활용하여 시각적 호흡 공간 확보
- 부드럽게 둥근 모서리(12~16dp)로 친근한 인상 유지
- 반투명 표면과 미세한 테두리로 깊이감 표현
- 색상 계층을 활용한 명확한 정보 위계

---

## 2. 색상 팔레트

### 시그니처 색상
| 역할 | 이름 | 헥스 코드 | 용도 |
|------|------|-----------|------|
| Primary | TWS Sky Blue | `#5DADE2` | CTA, 강조, 활성 상태 |
| Primary Light | Sky Blue Light | `#7EC8E3` | 다크모드 Primary, 컨테이너 |
| Primary Dark | Sky Blue Dark | `#3498DB` | 그래디언트 시작점 |
| Secondary | TWS Mint | `#48D1CC` | 보조 강조, 그래디언트 |
| Secondary Light | Mint Light | `#5FDDC5` | 보조 컨테이너 |

### 라이트 모드
| 역할 | 헥스 코드 | 설명 |
|------|-----------|------|
| Background | `#F8FBFF` | 크림빛 하늘색 — 순백보다 따뜻한 배경 |
| Surface | `#FFFFFF` | 카드/시트 표면 |
| Surface Glass | `#FFFFFF` (70%) | 글래스 효과 표면 |
| Surface Variant | `#EEF4F9` | 비활성 영역, 구분자 배경 |
| Border | `#5DADE2` (30%) | 미세한 하늘빛 테두리 |
| Text Primary | `#1B3A5F` | 남색 기반 본문 텍스트 |
| Text Secondary | `#6B8CAE` | 보조 설명, 라벨 |
| Text Tertiary | `#9BB3C9` | 플레이스홀더, 힌트 |

### 다크 모드
| 역할 | 헥스 코드 | 설명 |
|------|-----------|------|
| Background | `#0D1B2A` | 깊은 네이비 배경 |
| Surface | `#1B2D44` | 카드 표면 |
| Surface Glass | `#1E375A` (60%) | 반투명 다크 글래스 |
| Surface Variant | `#243B55` | 구분 영역 |
| Border | `#7EC8E3` (20%) | 은은한 블루 테두리 |
| Text Primary | `#FFFFFF` | 밝은 본문 |
| Text Secondary | `#A8C5DB` | 보조 텍스트 |
| Text Tertiary | `#6B8CAE` | 비활성 텍스트 |

### 시맨틱 색상
| 역할 | 헥스 코드 | 용도 |
|------|-----------|------|
| Error | `#E74C3C` | 삭제, 에러, 위험 |
| Error Container | `#FDEDED` | 에러 배경 (라이트) |
| Success | `#2ECC71` | 완료, 성공 |
| Success Container | `#E8F8F0` | 성공 배경 |
| Warning | `#F39C12` | 경고, 주의 |
| Warning Container | `#FEF5E7` | 경고 배경 |

### 카테고리 색상 팔레트
카테고리/태그에 사용되는 선명한 색상:
`#E74C3C` Red, `#E91E8C` Pink, `#9B59B6` Purple, `#3498DB` Blue,
`#2ECC71` Green, `#F1C40F` Yellow, `#E67E22` Orange, `#1ABC9C` Teal,
`#95A5A6` Gray, `#FF6B6B` Coral

- 카테고리 배경: 해당 색상의 10~15% 불투명도
- 카테고리 텍스트: 해당 색상 원본
- 기본 카테고리 색상: `#5DADE2` (TWS Sky Blue)

---

## 3. 타이포그래피

**폰트**: System Default (iOS SF Pro 느낌 추구)
**특징**: 약간 좁은 letter spacing으로 모던하고 깔끔한 인상

| 스타일 | 크기 | 두께 | 행간 | 자간 | 용도 |
|--------|------|------|------|------|------|
| Display Large | 34sp | Bold | 41sp | -0.5sp | 히어로 제목 |
| Display Medium | 28sp | Bold | 34sp | -0.5sp | 대형 제목 |
| Display Small | 24sp | SemiBold | 30sp | -0.25sp | 중형 제목 |
| Headline Large | 24sp | SemiBold | 30sp | -0.25sp | 화면 제목 |
| Headline Medium | 20sp | SemiBold | 26sp | -0.15sp | 섹션 헤더 |
| Headline Small | 18sp | SemiBold | 24sp | -0.15sp | 카드 제목, 발신자 |
| Title Large | 18sp | SemiBold | 24sp | -0.15sp | 탭/네비게이션 제목 |
| Title Medium | 16sp | Medium | 22sp | -0.1sp | TopAppBar 제목 |
| Title Small | 14sp | Medium | 20sp | 0sp | 섹션 소제목 (코멘트, 상태) |
| Body Large | 16sp | Normal | 24sp | 0sp | 메시지 본문 |
| Body Medium | 15sp | Normal | 22sp | 0sp | 일반 텍스트 |
| Body Small | 13sp | Normal | 18sp | 0sp | 보조 설명, 시간 |
| Label Large | 16sp | SemiBold | 22sp | 0sp | 큰 버튼 텍스트 |
| Label Medium | 13sp | Medium | 18sp | 0sp | 태그, 뱃지, 카테고리 라벨 |
| Label Small | 11sp | Medium | 16sp | 0sp | 타임스탬프, 캡션 |

---

## 4. 간격 및 레이아웃

**기본 간격 단위**: 4dp 배수 체계

| 토큰 | 값 | 용도 |
|------|-----|------|
| spacing-xs | 4dp | 아이콘-텍스트 미세 간격 |
| spacing-sm | 8dp | 관련 요소 간 간격, 섹션 내부 |
| spacing-md | 12dp | 섹션 간 간격 (설정 화면) |
| spacing-lg | 16dp | 카드 패딩, 화면 수평 여백 |
| spacing-xl | 20dp | 카드 내부 패딩 |
| spacing-2xl | 32dp | 화면 하단 여백 |

**화면 수평 패딩**: 16dp
**카드 내부 패딩**: 20dp
**카드 간 수직 간격**: 4~8dp

---

## 5. 컴포넌트 스타일링

### Surface / Card
- 모서리: 부드럽게 둥근 16dp (RoundedCornerShape)
- 테두리: 0.5dp, outline 색상 30% 불투명도 — 미세하게 존재감을 주는 유리 테두리
- 배경: `surface` 색상 (흰색 / 다크 네이비)
- 그림자: 없음 (테두리로 깊이감 대체)

### 버튼
- **TextButton**: Primary 색상 텍스트, Bold 또는 SemiBold
- **OutlinedButton**: Primary 테두리, 내부 아이콘 + 텍스트
- **Button (Filled)**: Error 계열은 errorContainer 배경 사용
- **IconButton**: 32~48dp 터치 영역, 아이콘 16~24dp

### 입력 필드 (OutlinedTextField)
- 모서리: 12dp
- 포커스 테두리: Primary 색상
- 비포커스 테두리: outline 50% 불투명도
- 플레이스홀더: onSurfaceVariant 색상, bodyMedium 스타일

### 태그 / 뱃지
- 모서리: 8dp (알약보다 약간 각진 형태)
- 배경: 카테고리 색상 10% 불투명도
- 텍스트: 카테고리 색상 원본, labelMedium, SemiBold
- 내부 패딩: 수평 10dp, 수직 4dp

### 상태 칩 (Status Step)
- 모서리: 12dp
- 선택됨: 상태 색상 15% 배경 + 2dp 테두리
- 미선택: surfaceVariant 배경
- 내부: 8dp 원형 점 + 상태 이름

### 타임라인 (코멘트)
- 세로 라인: 2dp 너비, outline 30% 불투명도
- 점: 10dp 원형, Primary 색상
- 콘텐츠: 시간(labelSmall) + 본문(bodyMedium)
- 삭제: 16dp Close 아이콘, onSurfaceVariant 60%

### 다이얼로그
- ConfirmDialog: 제목 + 메시지 + 확인/취소 버튼
- SelectDialog: 목록 선택 형태

### 설정 섹션
- 제목: titleSmall, Bold
- 컨테이너: Surface + 0.5dp 테두리 + 12dp 모서리 + 16dp 패딩
- 섹션 간 간격: 12dp

---

## 6. 아이콘 가이드

**라이브러리**: Material Icons (Filled / Outlined)
- 네비게이션: `ArrowBack` (AutoMirrored)
- 삭제: `Delete` (error tint), `Close` (subtle)
- 전송: `Send` (AutoMirrored)
- 시간: `AccessTime`
- 메시지 출처: `Sms` (SMS), `Notifications` (앱 알림)
- 확장/축소: `ExpandMore` / `ExpandLess`
- 상태: `CheckCircle`, `Error`, `HourglassEmpty`
- 동기화: `Cloud`, `CloudDone`, `CloudOff`, `Sync`

**아이콘 크기 규칙**:
- TopAppBar 액션: 24dp (기본)
- 인라인 보조: 14~18dp
- 타임라인 삭제: 16dp
- 상태 표시: 16~20dp

---

## 7. 글래스모피즘 효과

MedNoti의 시각적 차별점. `TwsTheme.glassColors`로 접근.

| 토큰 | 라이트 | 다크 | 용도 |
|------|--------|------|------|
| Glass Surface | White 70% | Dark Blue 60% | 반투명 카드 |
| Glass Surface Light | White 50% | Dark Blue 40% | 경량 오버레이 |
| Glass Border | White 20% | Blue 20% | 글래스 테두리 |
| Shadow | Sky Blue 15% | Dark 25% | 미세한 그림자 |

**그래디언트**: Sky Blue → Mint → Sky Blue Light (배경 장식용)

---

## 8. UI 생성 가이드라인

새로운 화면이나 컴포넌트를 만들 때 따라야 할 원칙:

### DO (권장)
- `MaterialTheme.colorScheme`에서 색상 가져오기
- `MaterialTheme.typography`에서 텍스트 스타일 가져오기
- `Surface` + `BorderStroke(0.5.dp, outline 30%)` 패턴으로 카드 구성
- `RoundedCornerShape(12~16.dp)`로 모서리 처리
- 충분한 여백 (카드 내부 20dp, 화면 가장자리 16dp)
- `copy(alpha = ...)` 로 불투명도 조절

### DON'T (금지)
- 하드코딩된 색상값 직접 사용 (Color(0xFF...) 형태)
- 날카로운 모서리 (4dp 이하)
- 그림자 과다 사용 (테두리로 대체)
- 빽빽한 레이아웃 (최소 8dp 간격 유지)
- 볼드 과다 사용 (제목/강조에만 한정)

### 프롬프트 작성 팁 (Stitch Enhance 스킬 적용)
UI를 설명할 때 구체적이고 시각적인 표현을 사용:
- "부드럽게 둥근 카드" → `RoundedCornerShape(16.dp)`
- "속삭이는 테두리" → `BorderStroke(0.5.dp, outline.copy(alpha = 0.3f))`
- "하늘빛 강조" → `MaterialTheme.colorScheme.primary`
- "넉넉한 숨 쉴 공간" → `padding(20.dp)`
- "미세한 깊이감" → Surface + 얇은 border (그림자 대신)
