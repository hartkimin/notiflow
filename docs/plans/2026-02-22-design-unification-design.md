# NotiFlow Design Unification — Design Document

**Date**: 2026-02-22
**Goal**: 상용화 배포를 위한 전체 디자인 통일 및 NotiFlow 브랜딩 리프레시
**Constraint**: 기능 변경 없음 (디자인/스타일만 수정)

---

## 1. 개요

NotiFlow Android 앱의 디자인을 통일합니다:
- TWS iOS Glassmorphism 스타일 → **NotiFlow Indigo Glassmorphism**으로 리프레시
- 코드 네이밍: `Tws*` → `NotiFlow*` 전체 리네이밍
- 글꼴: System Default → **Pretendard**
- 하드코딩 색상/간격/폰트 스케일링 제거
- DESIGN.md를 NotiFlow 브랜드로 갱신

## 2. 접근 방식: Theme-First

1. 테마 파일(Color.kt, Theme.kt, Type.kt) 전면 재정의
2. `Tws*` → `NotiFlow*` 리네이밍 (전체 코드베이스)
3. DESIGN.md 갱신
4. 화면별 하드코딩 제거 및 디자인 시스템 준수

---

## 3. 색상 팔레트

### 3.1 시그니처 색상

| 역할 | 이름 | 헥스 코드 | 용도 |
|------|------|-----------|------|
| Primary | NotiFlow Indigo | `#6366F1` | CTA, 강조, 활성 상태 |
| Primary Light | Indigo Light | `#818CF8` | 다크모드 Primary, 컨테이너 |
| Primary Dark | Indigo Dark | `#4F46E5` | 그래디언트 시작점 |
| Secondary | NotiFlow Violet | `#8B5CF6` | 보조 강조, 그래디언트 |
| Secondary Light | Violet Light | `#A78BFA` | 보조 컨테이너 |

### 3.2 라이트 모드

| 역할 | 헥스 코드 | 설명 |
|------|-----------|------|
| Background | `#FAFAFE` | 쿨 화이트 — 인디고와 조화 |
| Surface | `#FFFFFF` | 카드/시트 표면 |
| Surface Glass | `#FFFFFF` (70%) | 글래스 효과 표면 |
| Surface Variant | `#F1F0FB` | 연한 인디고 틴트 |
| Border | `#6366F1` (25%) | 인디고 기반 미세 테두리 |
| Text Primary | `#1E1B4B` | 딥 인디고 네이비 |
| Text Secondary | `#6B7280` | 뉴트럴 그레이 |
| Text Tertiary | `#9CA3AF` | 플레이스홀더, 힌트 |

### 3.3 다크 모드

| 역할 | 헥스 코드 | 설명 |
|------|-----------|------|
| Background | `#0F0D1A` | 딥 인디고 블랙 |
| Surface | `#1C1A2E` | 다크 인디고 서피스 |
| Surface Glass | `#1C1A2E` (60%) | 반투명 다크 글래스 |
| Surface Variant | `#2D2B42` | 구분 영역 |
| Border | `#818CF8` (20%) | 인디고 라이트 테두리 |
| Text Primary | `#FFFFFF` | 밝은 본문 |
| Text Secondary | `#A5B4FC` | 연한 인디고 |
| Text Tertiary | `#6B7280` | 비활성 텍스트 |

### 3.4 시맨틱 색상 (변경 없음)

| 역할 | 헥스 코드 |
|------|-----------|
| Error | `#E74C3C` |
| Error Container | `#FDEDED` |
| Success | `#2ECC71` |
| Success Container | `#E8F8F0` |
| Warning | `#F39C12` |
| Warning Container | `#FEF5E7` |

### 3.5 글래스모피즘 & 그래디언트

| 토큰 | 라이트 | 다크 |
|------|--------|------|
| Glass Surface | White 70% | `#1C1A2E` 70% |
| Glass Surface Light | White 50% | `#2D2B42` 50% |
| Glass Border | White 40% | `#818CF8` 30% |
| Shadow | `#818CF8` 20% | Black 30% |
| Gradient Start | `#818CF8` Indigo Light | `#4F46E5` Indigo Dark |
| Gradient Middle | `#A78BFA` Violet Light | `#8B5CF6` Violet |
| Gradient End | `#C4B5FD` Soft Lavender | `#6366F1` Indigo |

### 3.6 카테고리 색상 (변경 없음)

`#E74C3C` Red, `#E91E8C` Pink, `#9B59B6` Purple, `#3498DB` Blue,
`#2ECC71` Green, `#F1C40F` Yellow, `#E67E22` Orange, `#1ABC9C` Teal,
`#95A5A6` Gray, `#FF6B6B` Coral

기본 카테고리 색상: `#6366F1` (NotiFlow Indigo)

---

## 4. 타이포그래피

### 4.1 글꼴: Pretendard

- **Pretendard Variable** TTF 적용
- `res/font/pretendard_variable.ttf` 배치
- FontFamily 정의 후 전체 Typography에 적용

### 4.2 타이포그래피 스케일

| 스타일 | 크기 | 두께 | 행간 | 자간 | 용도 |
|--------|------|------|------|------|------|
| Display Large | 34sp | Bold | 41sp | -0.5sp | 히어로 제목 |
| Display Medium | 28sp | Bold | 34sp | -0.5sp | 대형 제목 |
| Display Small | 24sp | SemiBold | 30sp | -0.25sp | 중형 제목 |
| Headline Large | 24sp | SemiBold | 30sp | -0.25sp | 화면 제목 |
| Headline Medium | 20sp | SemiBold | 26sp | -0.15sp | 섹션 헤더 |
| Headline Small | 18sp | SemiBold | 24sp | -0.15sp | 카드 제목 |
| Title Large | 18sp | SemiBold | 24sp | -0.15sp | 탭/네비 제목 |
| Title Medium | 16sp | Medium | 22sp | -0.1sp | TopAppBar |
| Title Small | 14sp | Medium | 20sp | 0sp | 소제목 |
| Body Large | 16sp | Normal | 24sp | 0sp | 메시지 본문 |
| Body Medium | 15sp | Normal | 22sp | 0sp | 일반 텍스트 |
| Body Small | 13sp | Normal | 18sp | 0sp | 보조 설명 |
| Label Large | 16sp | SemiBold | 22sp | 0sp | 큰 버튼 |
| Label Medium | 13sp | Medium | 18sp | 0sp | 태그, 뱃지 |
| Label Small | 11sp | Medium | 16sp | 0sp | 타임스탬프 |

**신규 토큰**: `labelSmall * 0.8f` 패턴 5곳 → 해당 부분은 `labelSmall`로 통일하거나 UI 레이아웃 조정으로 해결

---

## 5. 컴포넌트 통일 규칙

### 5.1 Surface / Card

- 모서리: **16dp** (RoundedCornerShape)
- 테두리: **0.5dp**, `outline.copy(alpha = 0.25f)`
- 그림자: **없음** (테두리로 깊이감 대체)
- 내부 패딩: **20dp**
- 배경: `MaterialTheme.colorScheme.surface`

### 5.2 버튼

- TextButton: Primary 색상, SemiBold
- OutlinedButton: Primary 테두리 + 아이콘 + 텍스트
- Filled Button: Error 계열은 errorContainer 배경
- IconButton: 32~48dp 터치, 아이콘 16~24dp

### 5.3 입력 필드

- 모서리: 12dp
- 포커스 테두리: Primary (Indigo)
- 비포커스: outline 50%

### 5.4 태그/뱃지

- 모서리: **8dp**
- 배경: 카테고리 색상 10% 불투명도
- 텍스트: 카테고리 색상, labelMedium, SemiBold
- 패딩: 수평 10dp, 수직 4dp

### 5.5 채팅 버블 (AppChatStyle)

- 앱별 고유 색상 **유지** — Color.kt로 이동하여 관리
- 모서리: 최소 **8dp** (현재 4dp → 8dp로 수정)
- 네이밍: `NotiFlowChat*` 접두사

### 5.6 아이콘

- 네비게이션: **Filled** (Icons.Default)
- 인라인 액션: **Outlined** (Icons.Outlined)
- TopAppBar: 24dp
- 인라인 보조: 18dp
- 타임라인/삭제: 16dp

### 5.7 간격 (4dp 그리드)

| 토큰 | 값 |
|------|-----|
| spacing-xs | 4dp |
| spacing-sm | 8dp |
| spacing-md | 12dp |
| spacing-lg | 16dp |
| spacing-xl | 20dp |
| spacing-2xl | 32dp |

**수정 대상**: 6dp→8dp, 10dp→12dp, 14dp→16dp, 92dp→88dp

---

## 6. 리네이밍 계획

### 6.1 Color.kt

| 현재 | 새로운 |
|------|--------|
| `TwsSkyBlue` | `NotiFlowIndigo` |
| `TwsSkyBlueLight` | `NotiFlowIndigoLight` |
| `TwsSkyBlueDark` | `NotiFlowIndigoDark` |
| `TwsMint` | `NotiFlowViolet` |
| `TwsMintLight` | `NotiFlowVioletLight` |
| `TwsWhite` | `NotiFlowWhite` |
| `TwsCream` | `NotiFlowCream` |
| `TwsLight*` | `NotiFlowLight*` |
| `TwsDark*` | `NotiFlowDark*` |
| `TwsError` / `TwsSuccess` / `TwsWarning` | `NotiFlowError` / `NotiFlowSuccess` / `NotiFlowWarning` |
| `TwsGlass*` | `NotiFlowGlass*` |
| `TwsGradient*` | `NotiFlowGradient*` |
| `TwsShadow*` | `NotiFlowShadow*` |
| `TwsRed`, `TwsPink`, etc. | `NotiFlowRed`, `NotiFlowPink`, etc. |

### 6.2 Theme.kt

| 현재 | 새로운 |
|------|--------|
| `TwsLightColorScheme` | `NotiFlowLightColorScheme` |
| `TwsDarkColorScheme` | `NotiFlowDarkColorScheme` |
| `TwsTheme` | `NotiFlowDesign` |
| `NotiFlowTheme` (함수) | 유지 |

### 6.3 DESIGN.md

- 제목: "MedNoti Design System" → "NotiFlow Design System"
- 모든 TWS/MedNoti 참조 → NotiFlow로 변경

---

## 7. 화면별 수정 대상

### 7.1 하드코딩 색상 제거

| 파일 | 하드코딩 색상 | 수정 방법 |
|------|-------------|----------|
| MessageCard.kt | `Color(0xFFF59E0B)` | → `NotiFlowWarning` |
| MessageListScreen.kt | `Color(0xFFF59E0B)` | → `NotiFlowWarning` |
| MessageDetailScreen.kt | `Color(0xFFF59E0B)` | → `NotiFlowWarning` |
| AppChatStyle.kt | 20+ 하드코딩 색상 | → Color.kt로 이동 |
| SplashScreen.kt | 다수 하드코딩 색상 | → 인디고 기반으로 교체 |

### 7.2 그림자 제거

| 파일 | 현재 | 수정 |
|------|------|------|
| MessageCard.kt | 8dp shadow | → 제거, 0.5dp border |
| KanbanScreen.kt | 8dp shadow | → 제거, 0.5dp border |
| AppNavigation.kt (BottomNav) | 16dp shadow | → 유지 (네비게이션 바는 예외) |

### 7.3 비표준 간격 수정

| 파일 | 현재 | 수정 |
|------|------|------|
| MessageCard.kt | 6dp, 10dp | → 8dp, 12dp |
| MessageDetailScreen.kt | 14dp, 10dp | → 16dp, 12dp |
| KanbanScreen.kt | 14dp | → 16dp |
| MessageListScreen.kt | 92dp bottom | → 88dp |

### 7.4 폰트 스케일링 제거

| 파일 | 현재 | 수정 |
|------|------|------|
| MessageListScreen.kt | `labelSmall.fontSize * 0.8f` | → `labelSmall` 그대로 사용 |
| KanbanScreen.kt | `labelSmall.fontSize * 0.8f/0.85f` | → `labelSmall` 그대로 사용 |
| MessageDetailScreen.kt | `labelSmall.fontSize * 0.85f` | → `labelSmall` 그대로 사용 |

### 7.5 모서리 수정

| 파일 | 현재 | 수정 |
|------|------|------|
| AppChatStyle.kt | 4dp corners | → 8dp minimum |
| MessageListScreen.kt | 10dp search | → 12dp |

---

## 8. 변경하지 않는 것

- **기능 로직**: 모든 ViewModel, Repository, DAO, Service 등 기능 코드 미수정
- **네비게이션 구조**: 화면 이동 로직 유지
- **데이터 모델**: Entity, DTO 등 미수정
- **API 통신**: Supabase Edge Function 호출 미수정
- **앱별 채팅 색상**: 앱 고유 색상은 유지 (Color.kt로 이동만)
