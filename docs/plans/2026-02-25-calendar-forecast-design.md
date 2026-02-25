# Calendar Forecast & Message Matching Design

**Date**: 2026-02-25
**Status**: Approved
**Location**: Messages 캘린더에 통합

## Overview

Messages 캘린더에 **주문 예상(forecast)** 기능을 추가하여:
1. 일자별/주간별로 예상 주문을 미리 등록 (거래처 + 품목 + 노트)
2. 정기 주문 패턴을 등록해두고 자동으로 forecast 생성
3. 실제 메시지가 수신되면 예상과 자동 매칭 제안 → 수동 확인

## Data Model

### 새 테이블: `order_forecasts`

```sql
CREATE TYPE forecast_status_enum AS ENUM ('pending', 'matched', 'partial', 'missed', 'cancelled');

CREATE TABLE order_forecasts (
  id              SERIAL PRIMARY KEY,
  hospital_id     INT NOT NULL REFERENCES hospitals(id),
  forecast_date   DATE NOT NULL,
  notes           TEXT,
  status          forecast_status_enum NOT NULL DEFAULT 'pending',
  source          VARCHAR(20) DEFAULT 'manual',  -- manual | pattern
  pattern_id      INT REFERENCES order_patterns(id) ON DELETE SET NULL,
  message_id      INT REFERENCES raw_messages(id) ON DELETE SET NULL,
  matched_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(hospital_id, forecast_date)
);
```

### 새 테이블: `forecast_items`

```sql
CREATE TABLE forecast_items (
  id              SERIAL PRIMARY KEY,
  forecast_id     INT NOT NULL REFERENCES order_forecasts(id) ON DELETE CASCADE,
  product_id      INT REFERENCES products(id) ON DELETE SET NULL,
  product_name    VARCHAR(255),
  quantity        INT,
  unit_type       VARCHAR(20) DEFAULT 'piece',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 새 테이블: `order_patterns`

```sql
CREATE TABLE order_patterns (
  id              SERIAL PRIMARY KEY,
  hospital_id     INT NOT NULL REFERENCES hospitals(id),
  name            VARCHAR(100),
  recurrence      JSONB NOT NULL,          -- { "type": "weekly", "days": [1,3], "interval": 1 }
  default_items   JSONB,                   -- [{ "product_id": 5, "quantity": 10 }, ...]
  notes           TEXT,
  is_active       BOOLEAN DEFAULT true,
  last_generated  DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `raw_messages` 변경

```sql
ALTER TABLE raw_messages ADD COLUMN forecast_id INT REFERENCES order_forecasts(id) ON DELETE SET NULL;
```

## UI/UX Design

### Calendar Cell Display

```
┌─────────────── 2월 25일 (화) ───────────────┐
│  📋 A병원 (예상)            ← pending forecast
│  📋 B병원 (예상·매칭됨)      ← matched forecast
│  💬 카카오 · A병원 · 14:23   ← 실제 메시지
│  💬 카카오 · C병원 · 15:01   ← 실제 메시지 (예상없음)
│  +2건
└─────────────────────────────────────────────┘
```

**Color Coding:**
- Forecast pending: 파란 점선 배경, 주황 아이콘
- Forecast matched: 초록 체크 배경
- Forecast missed: 빨강 X 표시 (날짜 지났는데 미매칭)
- 수신 메시지: 기존 스타일 유지

### Forecast Input (Single)

- 캘린더 날짜 셀 **더블클릭** 또는 **"+ 예상 등록"** 버튼
- Dialog with: 날짜, 거래처(searchable combobox), 품목 리스트(추가/삭제), 노트

### Weekly Batch Input

- **"주간 예상 입력"** 버튼 → Dialog
- 거래처 선택 → 요일 체크박스(월~금) → 공통 품목 → 노트 → 일괄 등록
- 선택된 요일마다 동일한 forecast 생성

### Matching Confirmation UI

메시지 상세 패널에 매칭 후보 표시:
- 후보 forecast 정보 (거래처, 품목, 노트)
- [매칭 확인 ✓] / [무시] 버튼

## Matching Logic

### Auto-Match Criteria

```
1. hospital_id 일치
2. forecast_date = received_at 날짜 (±1일 허용)
3. forecast.status = 'pending'
```

### Confidence Levels

- **높음**: 거래처 + 날짜 정확 일치 → 자동 제안
- **보통**: 거래처 일치 + 날짜 ±1일 → 제안 + 주의 표시
- **낮음**: 거래처만 일치 → 목록에만 표시

### Pattern → Auto-Generate

- 트리거: 수동 "이번 주 예상 생성" 버튼 (cron은 향후)
- order_patterns.recurrence 규칙에 따라 다음 주 forecast 자동 생성
- source='pattern', pattern_id 설정

## API / Query Functions

| 함수 | 용도 |
|------|------|
| `getForecastsForCalendar(month)` | 월별 forecast 목록 |
| `createForecast(data)` | 단건 생성 (Server Action) |
| `createForecastBatch(data)` | 주간 일괄 생성 (Server Action) |
| `updateForecast(id, data)` | 수정 (Server Action) |
| `deleteForecast(id)` | 삭제 (Server Action) |
| `matchForecast(forecastId, messageId)` | 매칭 확인 (Server Action) |
| `findMatchingForecasts(messageId)` | 메시지에 대한 매칭 후보 검색 |
| `generateForecastsFromPatterns(weekStart)` | 패턴 기반 자동 생성 |

## Missed Forecast Handling

- 날짜 지난 pending forecast → 캘린더에서 빨간 "미수신" 표시
- 수동으로 "취소" 또는 "날짜 변경" 가능
- 자동 missed 처리는 향후 cron 추가

## Implementation Scope

### Phase 1 (Core)
- DB 마이그레이션 (3 테이블 + FK)
- Forecast CRUD (단건 + 일괄)
- Messages 캘린더 통합 표시
- 매칭 제안 + 확인 UI

### Phase 2 (Patterns)
- order_patterns CRUD UI
- 패턴 기반 자동 생성
- 패턴 관리 화면 (설정 또는 거래처 상세에 통합)

### Phase 3 (Enhancement)
- 예상 vs 실제 분석 리포트
- cron 자동 생성/missed 처리
- 매칭 정확도 학습
