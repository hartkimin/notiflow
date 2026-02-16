# TWS iOS Glassmorphism Theme Design

> **목적:** MedNoti 앱을 TWS(투어스) 콘셉트 + iOS 글래스모피즘 스타일로 리디자인

## 1. 컬러 팔레트

### TWS 시그니처 컬러
| 용도 | 라이트 모드 | 다크 모드 |
|------|------------|----------|
| **Primary** | Sky Blue `#5DADE2` | Bright Sky `#7EC8E3` |
| **Background** | Cream White `#F8FBFF` | Deep Navy `#0D1B2A` |
| **Surface (카드)** | White 70% `rgba(255,255,255,0.7)` | Dark Glass `rgba(30,55,90,0.6)` |
| **Text Primary** | Navy `#1B3A5F` | White `#FFFFFF` |
| **Text Secondary** | Gray Blue `#6B8CAE` | Light Blue `#A8C5DB` |
| **Accent** | Mint `#48D1CC` | Mint `#5FDDC5` |
| **Border** | Light Blue 30% `rgba(93,173,226,0.3)` | Blue 20% `rgba(126,200,227,0.2)` |

### 글래스모피즘 효과
- 배경 블러: 16dp ~ 24dp
- 카드 투명도: 60~70%
- 테두리: 1dp, 흰색/파란색 10~20% 투명도
- 그림자: 부드러운 블루 섀도우

## 2. 타이포그래피

| 용도 | 스타일 | 크기 | Weight |
|------|--------|------|--------|
| **대제목 (Hero)** | Display | 34sp | Bold (700) |
| **화면 제목** | Title Large | 24sp | SemiBold (600) |
| **섹션 제목** | Title Medium | 18sp | SemiBold (600) |
| **카드 제목** | Body Large | 16sp | Medium (500) |
| **본문** | Body | 15sp | Regular (400) |
| **보조 텍스트** | Caption | 13sp | Regular (400) |
| **버튼** | Button | 16sp | SemiBold (600) |

- Letter spacing: -0.02em
- Line height: 1.4 ~ 1.5

## 3. UI 컴포넌트

### 카드 (Glass Surface)
- 배경: White 70% (라이트) / Dark 60% (다크)
- 블러: 16dp backdrop blur
- 테두리: 1dp, White 20%
- 모서리: 16dp ~ 20dp
- 그림자: 0dp 4dp 24dp rgba(93,173,226,0.15)

### 버튼
| 타입 | 스타일 |
|------|--------|
| **Primary** | Sky Blue 배경, 흰색 텍스트, 12dp 라운드 |
| **Secondary** | Glass 배경 (White 50%), 블러, Blue 테두리 |
| **Ghost** | 투명, 텍스트만 Sky Blue |
| **Floating (FAB)** | 원형, 그라데이션 (Sky→Mint), 강한 블러 그림자 |

### 네비게이션 바
- Glass 효과 (White 80%, blur 20dp)
- 선택된 아이콘: Sky Blue + 작은 점 indicator
- iOS처럼 라벨 없이 아이콘만

## 4. 배경 이미지 구조

```
┌─────────────────────────────┐
│  Glass UI Components        │  ← 최상위
├─────────────────────────────┤
│  Blur Overlay (20dp)        │
├─────────────────────────────┤
│  Gradient Overlay           │
├─────────────────────────────┤
│  TWS Image (Cover)          │  ← 사용자 추가
└─────────────────────────────┘
```

### 화면별 배경
| 화면 | 배경 |
|------|------|
| 스플래시 | TWS 이미지 또는 그라데이션 |
| 메인 | 상단 그라데이션 페이드 |
| 목록 | 연한 패턴/그라데이션 |
| 상세 | TWS 컬러 그라데이션 |
| 설정 | 순수 Glass |

## 5. 이미지 폴더 구조

```
res/drawable/
├── splash/
│   └── tws_splash_bg.webp     (사용자 추가)
├── backgrounds/
│   ├── tws_bg_gradient.xml    (기본 그라데이션)
│   └── tws_bg_01.webp         (사용자 추가)
└── icons/
    └── tws_logo.webp          (사용자 추가)
```

## 6. 구현 파일 목록

1. `ui/theme/Color.kt` - TWS 컬러 팔레트
2. `ui/theme/Theme.kt` - 글래스모피즘 테마
3. `ui/theme/Type.kt` - iOS 타이포그래피
4. `ui/components/GlassComponents.kt` - Glass UI 컴포넌트
5. `ui/components/TwsBackground.kt` - 배경 컴포넌트
6. 기존 화면들 - Glass 스타일 적용
