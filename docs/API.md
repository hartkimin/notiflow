# NotiFlow Order System - API Reference

Base URL: `https://your-domain.com/api/v1`

All endpoints require `Authorization: Bearer <API_KEY>` header.

---

## Health Check

### `GET /health`

No auth required.

```json
{ "status": "ok", "uptime": 12345 }
```

---

## Messages

### `POST /api/v1/messages`

Receive and process an order message from NotiFlow app.

**Request Body:**

```json
{
  "source_app": "kakaotalk",
  "sender": "이한규내과",
  "content": "EK15 10박스\n니들 50개",
  "received_at": "2026-02-13T09:30:00Z"
}
```

**Response (201):**

```json
{
  "message_id": 42,
  "hospital_id": 38,
  "hospital_name": "이한규내과",
  "classification": "order",
  "parsed_items": [
    {
      "item": "EK15",
      "qty": 10,
      "unit": "box",
      "matched_product": "혈액투석여과기 EK-15H",
      "product_id": 28,
      "confidence": 1.0,
      "supplier_id": 3,
      "supplier_name": "니프로코리아"
    }
  ],
  "order_id": 15,
  "order_number": "ORD-20260213-001"
}
```

---

## Orders

### `GET /api/v1/orders`

List orders with optional filters.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by status: draft, confirmed, processing, delivered, cancelled |
| `hospital_id` | number | Filter by hospital |
| `from` | date | Start date (YYYY-MM-DD) |
| `to` | date | End date (YYYY-MM-DD) |
| `limit` | number | Page size (default 25) |
| `offset` | number | Pagination offset |

### `GET /api/v1/orders/:id`

Get order details including line items.

### `PATCH /api/v1/orders/:id`

Update order fields (e.g., status).

**Request Body:**

```json
{ "status": "processing" }
```

### `POST /api/v1/orders/:id/confirm`

Confirm an order. Triggers cascade:
1. Status updated to `confirmed`
2. Delivery date auto-scheduled
3. KPIS reports created for each item

**Response (200):**

```json
{
  "success": true,
  "delivery": { "order_id": 15, "delivery_date": "2026-02-14" },
  "kpis_reports": 3
}
```

---

## Deliveries

### `GET /api/v1/deliveries/today`

List today's pending deliveries.

### `PATCH /api/v1/deliveries/:orderId/delivered`

Mark an order as delivered.

### `POST /api/v1/deliveries/:orderId/schedule`

Manually schedule a delivery.

---

## Reports

### KPIS Reports

#### `GET /api/v1/reports/kpis/pending`

List all pending KPIS reports.

#### `GET /api/v1/reports/kpis/overdue`

List overdue reports (default: >7 days).

| Param | Type | Description |
|-------|------|-------------|
| `days` | number | Overdue threshold (default 7) |

#### `PATCH /api/v1/reports/kpis/:id/reported`

Mark a KPIS report as reported.

```json
{ "reference_number": "KPIS-2026-001", "notes": "Submitted via portal" }
```

### Sales Reports

#### `GET /api/v1/reports/sales?period=2026-01`

Generate monthly sales report.

**Response:**

```json
{
  "period": "2026-01",
  "rows": [
    {
      "order_number": "ORD-20260115-001",
      "hospital_name": "이한규내과",
      "business_number": "123-45-67890",
      "product_name": "XEVONTA HI 15",
      "quantity": 10,
      "supply_amount": 100000,
      "tax_amount": 10000
    }
  ],
  "summary": {
    "total_orders": 25,
    "total_items": 78,
    "total_supply": 15000000,
    "total_tax": 1500000,
    "total_amount": 16500000
  }
}
```

#### `GET /api/v1/reports/sales/export?period=2026-01`

Download sales report as CSV file (UTF-8 with BOM for Korean Excel).

---

## Statistics

### `GET /api/v1/stats/daily?date=2026-02-13`

Get daily processing statistics.

```json
{
  "date": "2026-02-13",
  "total_messages": 15,
  "success_messages": 12,
  "orders_created": 5
}
```

### `GET /api/v1/stats/summary?from=2026-02-01&to=2026-02-13`

Get summary statistics for a date range.

---

## Webhooks

### `POST /api/v1/webhooks/nocodb`

Receive NocoDB webhook events.

**Supported Tables/Events:**

| Table | Event | Action |
|-------|-------|--------|
| `order_items` | update | Auto-learn product alias when product_id is manually set |
| `orders` | update | Send notification on status change |
| `kpis_reports` | update | Track KPIS status changes |

**Request Body:**

```json
{
  "table": "order_items",
  "event": "update",
  "data": {
    "Id": 42,
    "product_id": 28,
    "original_text": "EK15",
    "hospital_id": 38,
    "previous": { "product_id": null }
  }
}
```

---

## Error Responses

All errors follow this format:

```json
{ "error": "Description of the error" }
```

| Status | Description |
|--------|-------------|
| 400 | Bad request (invalid parameters) |
| 401 | Unauthorized (missing or invalid API key) |
| 404 | Resource not found |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
| 503 | Service unavailable (dependency down) |
