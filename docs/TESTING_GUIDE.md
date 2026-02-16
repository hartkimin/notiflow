# NotiFlow 실제 테스트 가이드

이 문서는 NotiFlow 시스템을 처음부터 끝까지 실제로 띄우고 테스트하는 과정을 설명합니다.

---

## 목차

1. [사전 준비](#1-사전-준비)
2. [환경 설정 (.env)](#2-환경-설정)
3. [Docker 서비스 시작](#3-docker-서비스-시작)
4. [서비스 정상 확인](#4-서비스-정상-확인)
5. [NocoDB 초기 설정](#5-nocodb-초기-설정)
6. [엑셀 데이터 임포트](#6-엑셀-데이터-임포트)
7. [NocoDB 뷰 설정](#7-nocodb-뷰-설정)
8. [API 기능 테스트](#8-api-기능-테스트)
9. [텔레그램 알림 테스트](#9-텔레그램-알림-테스트)
10. [NocoDB Webhook 설정 및 테스트](#10-nocodb-webhook-설정-및-테스트)
11. [문제 해결](#11-문제-해결)

---

## 1. 사전 준비

### 필요한 프로그램 설치

| 프로그램 | 버전 | 확인 명령어 |
|---------|------|-----------|
| Docker | 24+ | `docker --version` |
| Docker Compose | v2+ | `docker compose version` |
| Node.js | 22+ | `node --version` |
| curl | any | `curl.exe --version` (Windows PowerShell에서는 반드시 `curl.exe` 사용) |

### 필요한 계정/토큰 (선택사항)

| 항목 | 용도 | 없으면? |
|------|------|--------|
| Claude API Key | AI 주문 파싱 | regex 파서로 자동 대체 |
| Telegram Bot Token | 알림 전송 | 알림 기능 비활성화 |
| Telegram Chat ID | 알림 수신 대상 | 알림 기능 비활성화 |

> Claude API Key와 Telegram 없이도 핵심 기능(주문 접수/관리)은 정상 동작합니다.

---

## 2. 환경 설정

### 2-1. .env 파일 생성

```bash
cd notiflow-order-system
cp .env.example .env
```

### 2-2. .env 파일 편집

에디터로 `.env`를 열고 아래 값들을 설정합니다.

```env
# === 필수 설정 ===

# DB 비밀번호
POSTGRES_PASSWORD=wkdgns2!@#

# API 인증 키
API_KEY=wkdgns2!@#

# Webhook 시크릿 (NocoDB → API 연동용)
WEBHOOK_SECRET=wkdgns2!@#

# NocoDB JWT 시크릿
NC_AUTH_JWT_SECRET=wkdgns2!@#

# === 아래는 나중에 설정 (5단계에서 발급) ===
NOCODB_API_TOKEN=your_nocodb_api_token_here

# === 선택 설정 (없으면 비워두기) ===
CLAUDE_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

> **중요**: `NOCODB_API_TOKEN`은 NocoDB가 시작된 후 발급받으므로, 지금은 임시값 그대로 둡니다.

---

## 3. Docker 서비스 시작

### 3-1. 서비스 빌드 및 시작

```bash
docker compose up -d --build
```

이 명령어로 5개 서비스가 시작됩니다:

```
✅ notiflow-postgres    (PostgreSQL 16)   → port 5432
✅ notiflow-redis       (Redis 7)         → port 6379
✅ notiflow-nocodb      (NocoDB)          → port 8080
✅ notiflow-api         (API Gateway)     → port 3000
✅ notiflow-caddy       (Caddy Proxy)     → port 80/443
```

### 3-2. 시작 상태 확인

```bash
docker compose ps
```

모든 서비스의 Status가 `Up` 또는 `Up (healthy)`이면 성공입니다.

### 3-3. 시작이 안 되는 경우

```bash
# 로그 확인
docker compose logs

# 특정 서비스 로그만 보기
docker compose logs api-gateway
docker compose logs nocodb
```

---

## 4. 서비스 정상 확인

하나씩 확인합니다. 모든 명령어를 복사해서 터미널에 붙여넣기 하세요.

> **Windows PowerShell 사용자**: PowerShell에서 `curl`은 `Invoke-WebRequest`의 별칭입니다. 반드시 `curl.exe`를 사용하세요. 아래 모든 명령어는 `curl.exe` 기준입니다.

### 4-1. PostgreSQL

```bash
docker compose exec postgres pg_isready -U notiflow
```

**성공 출력:**
```
/var/run/postgresql:5432 - accepting connections
```

### 4-2. Redis

```bash
docker compose exec redis redis-cli ping
```

**성공 출력:**
```
PONG
```

### 4-3. NocoDB

```bash
curl.exe -s http://localhost:8080/api/v1/health
```

**성공**: JSON 응답이 나오면 OK (또는 브라우저에서 `http://localhost:8080` 접속 확인)

### 4-4. API Gateway

```bash
curl.exe -s http://localhost:3000/health
```

**성공 출력:**
```json
{"status":"ok","version":"3.1.0","timestamp":"2026-02-13T..."}
```

### 4-5. 한꺼번에 확인 (Makefile)

```bash
make health
```

> 모든 서비스가 정상이면 다음 단계로 진행합니다.

---

## 5. NocoDB 초기 설정

### 5-1. NocoDB 접속

브라우저에서 `http://localhost:8080` 을 엽니다.

### 5-2. 관리자 계정 생성

1. **Sign Up** 클릭
2. 이메일, 비밀번호 입력
3. 계정 생성 완료

### 5-3. 데이터베이스 연결 확인

PostgreSQL이 자동으로 연결되어 있어야 합니다. `init-db.sql`에 정의된 13개 테이블이 보이면 성공입니다:

```
hospitals, products, product_aliases, product_box_specs,
suppliers, product_suppliers, raw_messages, orders,
order_items, parse_history, notification_logs,
kpis_reports, sales_reports
```

### 5-4. API Token 발급

1. 좌측 하단 **프로필 아이콘** → **Account Settings** (또는 Team & Settings)
2. **API Tokens** 탭 클릭
3. **Add New Token** 클릭
4. 토큰 이름: `notiflow-api` 입력 → **Generate**
5. 생성된 토큰을 **복사**

### 5-5. .env에 토큰 설정

```bash
# .env 파일을 열고 아래 줄을 수정
NOCODB_API_TOKEN=붙여넣기한_토큰값
```

### 5-6. API Gateway 재시작 (토큰 적용)

```bash
docker compose restart api-gateway
```

### 5-7. 토큰 적용 확인

```bash
# API Gateway가 NocoDB에 접근 가능한지 테스트
curl.exe -s http://localhost:3000/health
```

정상 응답이 나오면 연결 성공입니다.

---

## 6. 엑셀 데이터 임포트

### 6-1. 엑셀 파일 준비

아래 엑셀 파일을 `scripts/data/` 폴더에 넣습니다:

```bash
mkdir -p scripts/data

# 아래 파일들을 scripts/data/ 에 복사:
#   - 발주서_v2.2.xlsx       (품목/공급사/병원 마스터)
#   - 이한규내과 데이타.xlsx   (카카오톡 별칭 데이터)
```

### 6-2. Dry-run (실제 임포트 전 확인)

먼저 데이터가 제대로 파싱되는지만 확인합니다:

```bash
cd api-gateway
npm install     # 첫 실행 시 패키지 설치
node ../scripts/import-excel.js --dry-run
```

**확인할 것:**
- 파싱 에러가 없는지
- 각 테이블별 건수가 맞는지

### 6-3. 실제 임포트 실행

```bash
node ../scripts/import-excel.js
```

**예상 출력:**
```
📦 NotiFlow Data Import
==================================================
Step 1/7: Importing suppliers...
  ✅ Suppliers: 8 rows inserted
Step 2/7: Importing hospitals...
  ✅ Hospitals: 12 rows inserted
...
==================================================
✅ Import complete!
```

### 6-4. 임포트 검증

```bash
node ../scripts/validate-import.js
```

모든 항목이 ✅이면 성공입니다.

### 6-5. NocoDB에서 확인

브라우저에서 `http://localhost:8080` 을 열고:
- `hospitals` 테이블: 병원 데이터 확인
- `products` 테이블: 품목 데이터 확인
- `product_aliases` 테이블: 별칭 데이터 확인

---

## 7. NocoDB 뷰 설정

> NocoDB 웹 UI에서 편리하게 데이터를 보기 위한 뷰 설정입니다.
> 자세한 내용은 `docs/NOCODB_VIEWS.md`를 참고하세요.

주요 뷰만 먼저 설정합니다:

1. **orders** 테이블 → Kanban 뷰 생성 → 그룹 필드: `status`
2. **orders** 테이블 → Calendar 뷰 생성 → 날짜 필드: `delivery_date`
3. **order_items** 테이블 → Grid 뷰 → `match_status` 기준 필터 추가

---

## 8. API 기능 테스트

모든 인증 키는 `wkdgns2!@#`로 통일되어 있습니다.
> **참고**: `!@#` 특수문자 때문에 curl에서 반드시 **작은따옴표**(`'`)로 감싸야 합니다. URL 쿼리에서는 `%21%40%23`으로 인코딩됩니다.
>
> **PowerShell 팁**: 여러 줄 명령어에서 줄바꿈 문자 `\`(Linux) 대신 백틱(`` ` ``)을 사용하세요. 또는 한 줄로 붙여서 실행해도 됩니다.

### 8-1. 주문 메시지 전송 (핵심 기능)

```bash
curl.exe -s -X POST http://localhost:3000/api/v1/messages \
  -H "Content-Type: application/json" \
  -H 'Authorization: Bearer wkdgns2!@#' \
  -d '{
    "source_app": "kakaotalk",
    "sender": "이한규내과",
    "content": "EK15 10박스\n니들 50개",
    "received_at": "2026-02-13T09:30:00+09:00"
  }' | python -m json.tool
```

**성공 응답에서 확인할 것:**
```
✅ "success": true
✅ "hospital": "이한규내과"     ← 병원 인식 성공
✅ "is_order": true             ← 주문으로 분류
✅ "order_number": "ORD-..."    ← 주문 번호 생성
✅ "matched_items": [...]       ← 품목 매칭 결과
```

> `python -m json.tool`은 JSON을 보기 좋게 출력합니다. 없으면 생략해도 됩니다.

### 8-2. 비주문 메시지 테스트

```bash
curl.exe -s -X POST http://localhost:3000/api/v1/messages \
  -H "Content-Type: application/json" \
  -H 'Authorization: Bearer wkdgns2!@#' \
  -d '{
    "source_app": "kakaotalk",
    "sender": "이한규내과",
    "content": "감사합니다. 좋은 하루 되세요.",
    "received_at": "2026-02-13T10:00:00+09:00"
  }' | python -m json.tool
```

**확인:** `"is_order": false`, `"parse_status": "skipped"`

### 8-3. 인라인 축약 주문 테스트 (b 20 G 20 스타일)

```bash
curl.exe -s -X POST http://localhost:3000/api/v1/messages \
  -H "Content-Type: application/json" \
  -H 'Authorization: Bearer wkdgns2!@#' \
  -d '{
    "source_app": "kakaotalk",
    "sender": "이한규내과",
    "content": "b 20 G 20",
    "received_at": "2026-02-13T11:00:00+09:00"
  }' | python -m json.tool
```

**확인:** `matched_items`에 2개 항목이 분리되어 있어야 합니다.

### 8-4. 주문 목록 조회

```bash
curl.exe -s http://localhost:3000/api/v1/orders \
  -H 'Authorization: Bearer wkdgns2!@#' \
  | python -m json.tool
```

**확인:** 위에서 생성한 주문이 목록에 표시되는지

### 8-5. 주문 상세 조회

```bash
# 주문 ID (위 목록에서 확인한 Id값 사용)
curl.exe -s http://localhost:3000/api/v1/orders/1 \
  -H 'Authorization: Bearer wkdgns2!@#' \
  | python -m json.tool
```

**확인:** `items` 배열에 주문 품목이 포함되어 있는지

### 8-6. 주문 확정 (delivery + KPIS 연쇄 실행)

```bash
curl.exe -s -X POST http://localhost:3000/api/v1/orders/1/confirm \
  -H 'Authorization: Bearer wkdgns2!@#' \
  | python -m json.tool
```

**확인:**
```
✅ "status": "confirmed"
✅ "items_count": 2 (또는 품목 수)
```

확정 후 NocoDB에서 확인:
- `orders` 테이블: status가 `confirmed`, delivery_date가 자동 설정
- `kpis_reports` 테이블: 품목별 보고서 레코드 생성

### 8-7. 오늘 배송 목록

```bash
curl.exe -s http://localhost:3000/api/v1/deliveries/today \
  -H 'Authorization: Bearer wkdgns2!@#' \
  | python -m json.tool
```

### 8-8. 배송 완료 처리

```bash
curl.exe -s -X PATCH http://localhost:3000/api/v1/deliveries/1/delivered \
  -H 'Authorization: Bearer wkdgns2!@#' \
  | python -m json.tool
```

**확인:** NocoDB에서 orders 테이블의 status가 `delivered`로 변경

### 8-9. KPIS 미보고 목록

```bash
curl.exe -s http://localhost:3000/api/v1/reports/kpis/pending \
  -H 'Authorization: Bearer wkdgns2!@#' \
  | python -m json.tool
```

### 8-10. KPIS 보고 완료 처리

```bash
# report ID (위 목록에서 확인)
curl.exe -s -X PATCH http://localhost:3000/api/v1/reports/kpis/1/reported \
  -H "Content-Type: application/json" \
  -H 'Authorization: Bearer wkdgns2!@#' \
  -d '{"reference_number": "KPIS-2026-001", "notes": "포털 보고 완료"}' \
  | python -m json.tool
```

### 8-11. 통계 조회

```bash
# 오늘 통계
curl.exe -s "http://localhost:3000/api/v1/stats/daily?date=2026-02-13" \
  -H 'Authorization: Bearer wkdgns2!@#' \
  | python -m json.tool

# 기간 통계
curl.exe -s "http://localhost:3000/api/v1/stats/summary?from=2026-02-01&to=2026-02-28" \
  -H 'Authorization: Bearer wkdgns2!@#' \
  | python -m json.tool
```

### 8-12. 매출 보고서

```bash
# JSON 보고서
curl.exe -s "http://localhost:3000/api/v1/reports/sales?period=2026-02" \
  -H 'Authorization: Bearer wkdgns2!@#' \
  | python -m json.tool

# CSV 다운로드
curl.exe -s "http://localhost:3000/api/v1/reports/sales/export?period=2026-02" \
  -H 'Authorization: Bearer wkdgns2!@#' \
  -o sales_2026-02.csv

# CSV 파일 확인
type sales_2026-02.csv
```

### 8-13. PDF 주문서 다운로드

```bash
curl.exe -s http://localhost:3000/api/v1/orders/1/pdf \
  -H 'Authorization: Bearer wkdgns2!@#' \
  -o order.pdf

# 파일 크기 확인 (0보다 크면 성공)
dir order.pdf
```

### 8-14. 인증 실패 테스트

```bash
# 잘못된 API Key로 요청
curl.exe -s http://localhost:3000/api/v1/orders \
  -H "Authorization: Bearer wrong-key"
```

**확인:** `401` 상태, `"error": "Unauthorized"` 응답

---

## 9. 텔레그램 알림 테스트

> Telegram Bot Token과 Chat ID가 설정된 경우에만 해당됩니다.

### 9-1. Telegram Bot 생성 (아직 없는 경우)

1. Telegram에서 **@BotFather** 검색 → 대화 시작
2. `/newbot` 입력
3. 봇 이름/유저네임 설정
4. **HTTP API token** 복사 → `.env`의 `TELEGRAM_BOT_TOKEN`에 설정

### 9-2. Chat ID 확인

1. 생성한 봇에게 아무 메시지 전송
2. 브라우저에서 아래 URL 접속:
   ```
   https://api.telegram.org/bot{YOUR_BOT_TOKEN}/getUpdates
   ```
3. `"chat": {"id": 123456789}` 에서 숫자를 복사
4. `.env`의 `TELEGRAM_CHAT_ID`에 설정

### 9-3. API Gateway 재시작

```bash
docker compose restart api-gateway
```

### 9-4. 알림 테스트

주문을 하나 더 보내봅니다:

```bash
curl.exe -s -X POST http://localhost:3000/api/v1/messages \
  -H "Content-Type: application/json" \
  -H 'Authorization: Bearer wkdgns2!@#' \
  -d '{
    "source_app": "kakaotalk",
    "sender": "이한규내과",
    "content": "EK13 3박스\n라인 5박스",
    "received_at": "2026-02-13T14:00:00+09:00"
  }'
```

**Telegram에서 확인:** 주문 생성 알림 메시지가 오는지 확인합니다.

---

## 10. NocoDB Webhook 설정 및 테스트

NocoDB에서 데이터가 변경될 때 API Gateway로 자동 알림을 보내는 설정입니다.

### 10-1. NocoDB Webhook 설정

1. NocoDB 웹 UI (`http://localhost:8080`) 접속
2. `order_items` 테이블 선택
3. 상단 메뉴 **... > Webhooks** 클릭
4. **+ Create Webhook** 클릭
5. 아래와 같이 설정:

| 필드 | 값 |
|------|---|
| Event | After Update |
| Method | POST |
| URL | `http://api-gateway:3000/api/v1/webhooks/nocodb?secret=wkdgns2%21%40%23` |
| Headers | `Content-Type: application/json` |

> URL의 `secret=` 값은 `.env`의 `WEBHOOK_SECRET`과 동일해야 합니다.

6. **Save** 클릭

같은 방식으로 `orders` 테이블과 `kpis_reports` 테이블에도 Webhook을 추가합니다.

### 10-2. Webhook 테스트

1. NocoDB에서 `order_items` 테이블을 열기
2. 아직 `product_id`가 비어있는(unmatched) 항목 찾기
3. `product_id` 셀을 클릭하여 제품 ID 입력
4. API Gateway 로그 확인:

```bash
docker compose logs -f api-gateway
```

**확인:** `alias_learned` 로그가 출력되면 별칭 자동학습이 작동하는 것입니다.

### 10-3. Webhook 수동 테스트

```bash
curl.exe -s -X POST "http://localhost:3000/api/v1/webhooks/nocodb?secret=wkdgns2%21%40%23" \
  -H "Content-Type: application/json" \
  -d '{
    "table": "orders",
    "event": "update",
    "data": {
      "Id": 1,
      "status": "processing",
      "previous": { "status": "confirmed" }
    }
  }' | python -m json.tool
```

**확인:** `"action": "notification_sent"` 응답

---

## 11. 문제 해결

### API Gateway가 시작 안 될 때

```bash
# 로그 확인
docker compose logs api-gateway

# 흔한 원인: NocoDB가 아직 준비되지 않음 → 재시작
docker compose restart api-gateway
```

### NocoDB 접속이 안 될 때

```bash
# PostgreSQL이 정상인지 확인
docker compose logs postgres

# NocoDB 재시작
docker compose restart nocodb
```

### "Unauthorized" 에러가 나올 때

- `.env`의 `API_KEY` 값과 curl의 `Bearer` 뒤 값이 정확히 같은지 확인
- `.env` 수정 후 반드시 `docker compose restart api-gateway` 실행

### NocoDB API Token 에러

- NocoDB 웹 UI에서 토큰 재발급
- `.env` 업데이트 후 `docker compose restart api-gateway`

### 주문 매칭이 안 될 때 (matched_items가 비어있음)

- 엑셀 임포트가 완료되었는지 확인 (`node ../scripts/validate-import.js`)
- `product_aliases` 테이블에 해당 별칭이 있는지 NocoDB에서 확인
- sender 이름이 `hospitals.kakao_sender_names`에 포함되어 있는지 확인

### 모든 데이터 초기화 (처음부터 다시)

```bash
# 주의: 모든 데이터가 삭제됩니다!
make clean          # docker compose down -v
docker compose up -d --build
```

---

## 테스트 체크리스트

아래 항목을 순서대로 체크하며 테스트를 진행하세요.

```
[ ] 1. Docker 서비스 5개 모두 Up
[ ] 2. health 엔드포인트 정상 응답
[ ] 3. NocoDB 웹 UI 접속 가능
[ ] 4. NocoDB API Token 발급 및 적용
[ ] 5. 엑셀 데이터 임포트 완료
[ ] 6. validate-import.js 전체 통과
[ ] 7. 주문 메시지 전송 → 주문 생성 성공
[ ] 8. 비주문 메시지 → 분류 성공 (is_order: false)
[ ] 9. 주문 목록 조회 정상
[ ] 10. 주문 확정 → delivery_date + KPIS 생성
[ ] 11. 배송 완료 처리 → status: delivered
[ ] 12. KPIS 보고 처리 정상
[ ] 13. 통계/매출보고서 조회 정상
[ ] 14. PDF 다운로드 정상
[ ] 15. (선택) 텔레그램 알림 수신 확인
[ ] 16. (선택) NocoDB Webhook 동작 확인
```
