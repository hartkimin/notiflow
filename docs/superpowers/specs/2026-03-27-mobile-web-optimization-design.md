# 모바일 웹 최적화 설계

## 개요

NotiFlow 웹 대시보드를 모바일에서 웹앱처럼 사용할 수 있도록 최적화한다. 주문 관리 중심의 모바일 UX를 구현하며, 기존 코드에 반응형 분기를 추가하는 방식으로 진행한다.

## 목표

- 모바일(< 768px)에서 네이티브 앱 수준의 주문 관리 UX 제공
- PWA 설치 유도로 홈 화면 추가 촉진
- 터치 제스처(풀투리프레시, 스와이프) 지원
- 데스크톱 UI는 현재 상태 유지

## 설계 결정 사항

| 항목 | 결정 |
|------|------|
| 접근 방식 | 반응형 분기 (md 브레이크포인트 기준) |
| 주문 목록 | 모바일: 카드형 UI / 데스크톱: 기존 테이블 유지 |
| 주문 상세 액션 | 모바일: 하단 고정 액션 바 |
| 하단 네비게이션 | 3탭 → 4탭 (주문/메시지/대시보드/더보기) |
| PWA | 설치 유도 배너 + 아이콘 개선 |
| 제스처 | 풀투리프레시 + 스와이프 상태 변경 |

## 주문 상태 모델

타입 정의(`types.ts`)에 5가지 상태가 존재하나, 현재 UI(`order-status.ts`)는 `confirmed`("미완료")와 `delivered`("완료") 2가지만 라벨링되어 있다. 이번 모바일 최적화에서 **기존 2상태 라벨을 그대로 사용**한다.

| DB 상태 | 모바일 표시 라벨 | 배지 색상 |
|---------|----------------|-----------|
| `confirmed` | 미완료 | secondary (회색) |
| `delivered` | 완료 | default (녹색) |

- 상태 필터 pill: **전체 / 미완료 / 완료** (2개 상태만)
- 스와이프 상태 변경: **미완료 → 완료** (단일 전환만 지원)
- `draft`, `invoiced`, `cancelled` 상태는 현재 UI에서 거의 사용되지 않으므로 필터에 포함하지 않음. 해당 상태의 주문이 존재하면 "전체" 필터에서만 노출.

## 상세 설계

### 1. 하단 네비게이션 (4탭)

현재 `mobile-nav.tsx`의 3탭(대시보드/주문/메시지)을 4탭으로 재구성한다.

**탭 구성:**
1. **주문** (`/orders`) — ClipboardList 아이콘, 주문 관리 (기본 탭)
2. **메시지** (`/messages`) — MessageSquare 아이콘, 알림/메시지 확인
3. **대시보드** (`/dashboard`) — LayoutGrid 아이콘, 통계/요약
4. **더보기** — MoreHorizontal 아이콘, Sheet 메뉴로 설정/병원/공급업체/제품/도움말 링크

**더보기 탭 동작:** 탭하면 하단에서 Sheet가 올라오며 나머지 메뉴 항목을 표시한다. 별도 페이지 이동 없이 현재 페이지 위에 오버레이된다.

**기존 햄버거 메뉴와의 관계:** `nav.tsx`의 햄버거 메뉴(Sheet, 왼쪽 슬라이드)를 모바일에서 제거한다 (`md:hidden` → 완전 제거). 더보기 Sheet가 동일 역할을 대체하므로 중복을 없앤다.

**변경 파일:** `apps/web/src/components/mobile-nav.tsx`, `apps/web/src/components/nav.tsx`

### 2. 주문 목록 — 카드형 UI

`md:` 이하에서 테이블 대신 카드형 리스트를 표시한다.

**카드 구조:**
```
┌─────────────────────────────────┐
│ ORD-20260327-001        [미완료] │
│ 서울대병원                       │
│ ₩1,250,000          3개 품목 · 오늘│
└─────────────────────────────────┘
```

**카드 정보 표시:**
- 1행: 주문번호 (좌) + 상태 배지 (우, `ORDER_STATUS_LABELS` 사용)
- 2행: 병원명
- 3행: 합계 금액 (좌) + 품목 수 · 날짜 (우)

**상태 필터:** 카드 리스트 상단에 가로 스크롤 pill 버튼 (전체/미완료/완료). 각 pill에 건수 표시.

**스와이프 상태 변경:** 카드를 왼쪽으로 스와이프하면 "완료 처리" 액션 버튼이 나타난다 (`confirmed` → `delivered` 전환만 지원). 이미 `delivered` 상태인 카드는 스와이프 비활성화. 스와이프 임계값은 카드 너비의 30%.

**스와이프 구현:** CSS `transform: translateX()` + `touchstart/touchmove/touchend` 이벤트. 외부 라이브러리 없이 순수 구현. `will-change: transform`으로 GPU 가속.

**접근성 폴백:** 스와이프 불가 환경(스크린 리더 등)에서는 카드 탭 시 상세 페이지로 이동하여 액션 바에서 상태 변경 가능.

**빈 상태:** 주문이 없을 때 "주문이 없습니다" 메시지와 아이콘 표시.

**에러 처리:** 스와이프 상태 변경 실패 시 카드를 원래 위치로 복귀 + toast 에러 메시지 표시.

**데스크톱:** 기존 테이블 UI 유지 (`hidden md:block` / `md:hidden` 분기).

**변경 파일:** `apps/web/src/components/order-table.tsx` + 새 `order-card-list.tsx` 컴포넌트

### 3. 주문 상세 — 하단 고정 액션 바

모바일에서 주문 상세 페이지 하단에 고정 액션 바를 추가한다.

**레이아웃:**
```
┌─────────────────────────────────┐
│ [← 뒤로]  ORD-20260327-001 [미완료]│
├─────────────────────────────────┤
│ 병원: 서울대병원                  │
│ 품목 (3개): ...                  │
│ 합계: ₩1,250,000                │
│                                  │
│         (스크롤 영역)             │
│                                  │
├─────────────────────────────────┤
│ [  수정  ] [    완료 처리      ] │  ← 고정 액션 바
└─────────────────────────────────┘
```

**액션 바 동작:**
- 보조 버튼 (좌): 수정 (outline 스타일)
- 주요 버튼 (우): 완료 처리 (primary 스타일, flex-2 너비) — `confirmed` → `delivered` 전환
- 이미 `delivered` 상태면 주요 버튼 숨기고 수정 버튼만 표시
- safe area 대응: `pb-[env(safe-area-inset-bottom)]` 적용

**기존 버튼과의 관계:** `order-detail-client.tsx`의 기존 인라인 상태 변경 버튼을 모바일에서 `md:hidden`으로 숨기고, 고정 액션 바가 동일한 `updateOrderStatusAction`을 호출한다. 데스크톱에서는 기존 버튼 유지.

**변경 파일:** `apps/web/src/components/order-detail-client.tsx` (액션 바를 이 클라이언트 컴포넌트 내부에 추가)

### 4. 풀투리프레시 (Pull-to-Refresh)

주문 목록과 메시지 목록에서 아래로 당기면 데이터를 새로고침한다.

**구현:**
- 터치 이벤트 기반 커스텀 훅 `usePullToRefresh`
- 스크롤 대상: `<main>` 요소 (dashboard layout의 `overflow-y-auto` 컨테이너). `scrollTop === 0`일 때만 풀투리프레시 활성화.
- 임계값: 80px 이상 당기면 새로고침 트리거
- 스피너 애니메이션 표시 후 `router.refresh()` 호출 (Server Component 데이터 리페치)
- 터치 이벤트 `passive: false`로 등록하여 기본 스크롤 방지
- 새로고침 중 추가 트리거 방지 (debounce)

**적용 범위:** 주문 목록, 메시지 목록 (모바일에서만 활성화, `pointer: coarse` 미디어쿼리 또는 `ontouchstart` 감지)

**실패 처리:** 새로고침 실패 시 스피너를 에러 아이콘으로 전환 후 1초 뒤 사라짐.

**변경 파일:** 새 훅 `apps/web/src/hooks/use-pull-to-refresh.ts`

### 5. PWA 개선

**5a. 설치 유도 배너:**
- `beforeinstallprompt` 이벤트 감지하여 배너 표시
- 그라데이션 배경의 배너 컴포넌트 (NotiFlow 로고 + 설치 CTA + 닫기)
- 닫기 시 localStorage에 저장하여 7일간 재표시 안 함
- standalone 모드로 이미 실행 중이면 배너 숨김 (`window.matchMedia('(display-mode: standalone)')`)

**5b. manifest.json 개선:**
- 192x192, 512x512 PNG 아이콘 추가 (기존 SVG에서 생성)
- `description` 필드 추가

**5c. viewport 설정:**
- `layout.tsx`에 Next.js `Viewport` export 추가:
```typescript
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};
```

**변경 파일:** 새 컴포넌트 `pwa-install-banner.tsx`, `manifest.json`, `layout.tsx`

### 6. 터치 타겟 개선

현재 헤더 네비게이션 버튼(프로필, 설정)이 32px(`h-8 w-8`)로 작다. 모바일에서 최소 44px로 확대한다. `globals.css`의 기존 `pointer: coarse` 미디어쿼리에 이미 버튼 최소 크기가 있으므로, 아이콘 버튼에 `data-slot="button"` 속성이 올바르게 적용되어 있는지 확인한다.

**변경 파일:** `apps/web/src/components/nav.tsx`

### 7. Safe Area Inset 대응

`viewport-fit=cover` 적용 시 노치/Dynamic Island 기기에서 하단 영역이 겹칠 수 있다.

- 하단 네비게이션 바: `padding-bottom: env(safe-area-inset-bottom)` 추가
- 하단 고정 액션 바: 동일하게 safe area 패딩 추가
- `globals.css`에 safe area 유틸리티 클래스 추가

**변경 파일:** `apps/web/src/app/globals.css`, `mobile-nav.tsx`, `order-detail-client.tsx`

## 변경 파일 목록

| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `components/mobile-nav.tsx` | 수정 | 3탭 → 4탭 + 더보기 Sheet + safe area |
| `components/order-table.tsx` | 수정 | 모바일 카드형 분기 추가 |
| `components/order-detail-client.tsx` | 수정 | 모바일 하단 고정 액션 바 추가 |
| `components/nav.tsx` | 수정 | 모바일 햄버거 메뉴 제거 + 터치 타겟 확대 |
| `app/layout.tsx` | 수정 | Viewport export 추가 |
| `public/manifest.json` | 수정 | 아이콘, 설명 추가 |
| `hooks/use-pull-to-refresh.ts` | 신규 | 풀투리프레시 훅 |
| `components/pwa-install-banner.tsx` | 신규 | PWA 설치 유도 배너 |
| `components/order-card-list.tsx` | 신규 | 모바일 주문 카드 리스트 + 스와이프 |
| `app/globals.css` | 수정 | safe area 유틸리티, 풀투리프레시 애니메이션 |

## 범위 밖

- 오프라인 지원 (서비스 워커 캐싱)
- 모바일 전용 주문 생성 폼
- 푸시 알림 (이미 별도 구현됨)
- 다크 모드
- 데스크톱 UI 변경
- 상태 모델 확장 (draft/invoiced/cancelled 라벨 추가)
