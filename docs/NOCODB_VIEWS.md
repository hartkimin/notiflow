# NocoDB View Configuration Guide

NocoDB 웹 UI에서 수동 설정하는 뷰 목록입니다.

## 1. 거래처 관리 (hospitals)

| 뷰 이름 | 유형 | 필터/조건 | 정렬 |
|---------|------|----------|------|
| 전체 거래처 | Grid | (없음) | name ASC |
| 활성 거래처 | Grid | `is_active = true` | name ASC |
| 유형별 | Grid (그룹) | 그룹: `hospital_type` | hospital_type, name ASC |

**표시 필드:** name, hospital_type, business_number, phone, address, kakao_sender_names, is_active

---

## 2. 품목 관리 (products)

| 뷰 이름 | 유형 | 필터/조건 | 정렬 |
|---------|------|----------|------|
| 전체 품목 | Grid | (없음) | official_name ASC |
| 카테고리별 | Grid (그룹) | 그룹: `category` | category, official_name ASC |
| 병원별 별칭 | Grid (product_aliases) | `hospital_id IS NOT NULL` | hospital_id, alias ASC |
| 글로벌 별칭 | Grid (product_aliases) | `hospital_id IS NULL` | alias ASC |

**표시 필드 (products):** official_name, short_name, category, standard_code, unit_price
**표시 필드 (product_aliases):** alias, alias_normalized, product_id, hospital_id, source

---

## 3. 공급사 관리 (suppliers, product_suppliers)

| 뷰 이름 | 유형 | 필터/조건 | 정렬 |
|---------|------|----------|------|
| 전체 공급사 | Grid (suppliers) | (없음) | name ASC |
| 품목별 공급사 | Grid (product_suppliers) | (없음) | product_id ASC |

**표시 필드 (suppliers):** name, contact_name, phone, email
**표시 필드 (product_suppliers):** product_id, supplier_id, is_primary, purchase_price

---

## 4. 주문 관리 (orders, order_items)

| 뷰 이름 | 유형 | 필터/조건 | 정렬 |
|---------|------|----------|------|
| 오늘 주문 | Grid | `order_date >= today 00:00` AND `order_date < tomorrow 00:00` | order_date DESC |
| 주간 주문 | Grid | `order_date >= 이번주 월요일` | order_date DESC |
| 월간 주문 | Grid | `order_date >= 이번달 1일` | order_date DESC |
| 상태별 (칸반) | Kanban | 그룹: `status` | order_date DESC |
| 배송 캘린더 | Calendar | 날짜 필드: `delivery_date` | — |
| 전체 주문 | Grid | (없음) | order_date DESC |

**표시 필드 (orders):** order_number, hospital_id, order_date, status, delivery_date, supply_amount, tax_amount, total_items
**표시 필드 (order_items):** order_id, product_id, quantity, unit_type, unit_price, line_total, match_status, supplier_id

---

## 5. KPIS 관리 (kpis_reports)

| 뷰 이름 | 유형 | 필터/조건 | 정렬 |
|---------|------|----------|------|
| 미신고 항목 | Grid | `report_status = 'pending'` | created_at ASC |
| 신고 완료 | Grid | `report_status = 'reported'` | reported_at DESC |

**표시 필드:** order_item_id, report_status, reported_at, reference_number, notes, created_at

---

## 6. 배송 관리 (orders — 배송 관련 뷰)

| 뷰 이름 | 유형 | 필터/조건 | 정렬 |
|---------|------|----------|------|
| 오늘 배송 | Grid | `delivery_date = today` AND `status != 'delivered'` | delivery_date ASC |
| 배송 대기 | Grid | `status = 'confirmed'` AND `delivery_date IS NOT NULL` | delivery_date ASC |
| 배송 캘린더 | Calendar | 날짜 필드: `delivery_date` | — |

---

## 7. 매출보고 (sales_reports)

| 뷰 이름 | 유형 | 필터/조건 | 정렬 |
|---------|------|----------|------|
| 월별 매출 | Grid (그룹) | 그룹: `report_period` | report_period DESC |

**표시 필드:** report_period, order_id, supplier_name, hospital_name, product_name, quantity, supply_amount, tax_amount

---

## 8. 메시지 관리 (raw_messages)

| 뷰 이름 | 유형 | 필터/조건 | 정렬 |
|---------|------|----------|------|
| 전체 메시지 | Grid | (없음) | received_at DESC |
| 파싱 성공 | Grid | `parse_status = 'success'` | received_at DESC |
| 파싱 실패 | Grid | `parse_status = 'failed'` | received_at DESC |
| 미처리 | Grid | `parse_status = 'pending'` | received_at DESC |

**표시 필드:** source_app, sender, content, received_at, parse_status, hospital_id, order_id

---

## 설정 방법

1. NocoDB 관리자 UI 접속 (`https://nocodb.your-domain.com`)
2. 각 테이블 클릭 → 좌측 상단 `+` 아이콘으로 뷰 추가
3. Grid, Kanban, Calendar 등 유형 선택
4. 필터/정렬/그룹 설정 후 저장
5. 뷰 이름을 위 표의 한글명으로 변경
