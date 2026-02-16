# NotiFlow + NocoDB v3.1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a hemodialysis medical supply order management system that automatically parses KakaoTalk/SMS order messages, matches products using hospital-specific aliases, and generates orders with supplier linkage.

**Architecture:** Node.js/Express API Gateway receives messages from the NotiFlow mobile app, identifies hospitals by sender name, uses Claude AI + regex fallback to parse orders, matches products via hospital-specific alias engine backed by Redis cache, and stores everything in PostgreSQL via NocoDB REST API. Docker Compose orchestrates all services on a personal server/NAS.

**Tech Stack:** Node.js 22 LTS, Express, PostgreSQL 16, Redis 7, NocoDB (self-hosted), Claude API (claude-haiku-4-5), fuse.js, xlsx (SheetJS), pdfkit, Jest, Docker Compose, Caddy, Telegram Bot API

**Reference docs:**
- Design: `docs/plans/2026-02-13-notiflow-nocodb-v3.1-design.md`
- Full plan: `notiflow_nocodb_dev_plan_v3.1.md`
- Existing Supabase schema: `mednoti_schema.sql`
- Excel data: `발주서_v2.2.xlsx`, `이한규내과 데이타.xlsx`

---

## Phase 1: Infrastructure + Data Import (Week 1)

### Task 1: Initialize project and Docker Compose

**Files:**
- Create: `notiflow-order-system/docker-compose.yml`
- Create: `notiflow-order-system/docker-compose.dev.yml`
- Create: `notiflow-order-system/.env.example`
- Create: `notiflow-order-system/.gitignore`

**Step 1: Create project directory structure**

```bash
mkdir -p notiflow-order-system/{api-gateway/src/{config,middleware,routes,services,utils},api-gateway/tests/integration,scripts/{parsers,data},templates,docs}
```

**Step 2: Write docker-compose.yml**

Services: postgres (16-alpine), redis (7-alpine), nocodb (latest), api-gateway (node:22-alpine), caddy.
- postgres: port 5432, volume `pg_data`, init script mount `./scripts/init-db.sql`
- redis: port 6379, volume `redis_data`
- nocodb: port 8080, depends_on postgres, env `NC_DB` pointing to postgres
- api-gateway: port 3000, depends_on postgres/redis/nocodb
- caddy: port 80/443, Caddyfile mount

**Step 3: Write docker-compose.dev.yml**

Override api-gateway with volume mount for hot-reload (nodemon).

**Step 4: Write .env.example**

All env vars: `POSTGRES_*`, `REDIS_URL`, `NOCODB_URL`, `NOCODB_API_TOKEN`, `CLAUDE_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `API_KEY`, `NODE_ENV`.

**Step 5: Write .gitignore**

node_modules, .env, pg_data, redis_data, *.log, dist/

**Step 6: Commit**

```bash
git init
git add docker-compose.yml docker-compose.dev.yml .env.example .gitignore
git commit -m "chore: initialize project with Docker Compose config"
```

---

### Task 2: Write PostgreSQL init schema (v3.1)

**Files:**
- Create: `notiflow-order-system/scripts/init-db.sql`

**Step 1: Write the full v3.1 schema**

13 tables in dependency order:
1. `hospitals` — with `hospital_type`, `kakao_sender_names JSON`, `business_number`, `payment_terms`, `trade_start_date`
2. `products` — with `official_name`, `short_name`, `ingredient`, `efficacy`, category ENUM values (dialyzer, blood_line, avf_needle, dialysis_solution, filter, catheter, medication, consumable, equipment, supplement, other)
3. `product_aliases` — with `hospital_id INT REFERENCES hospitals(id)`, UNIQUE(hospital_id, alias_normalized)
4. `product_box_specs` — qty_per_box, is_default
5. `suppliers` — name, short_name, contact_info JSON, is_active
6. `product_suppliers` — product_id, supplier_id, purchase_price, is_primary, UNIQUE(product_id, supplier_id)
7. `raw_messages` — source_app, sender, content, hospital_id FK, parse_status, parse_result JSON, order_id FK
8. `orders` — order_number, hospital_id, status, delivery_date, supply_amount, tax_amount, delivered_at
9. `order_items` — order_id, product_id, supplier_id, box_spec_id, quantity, unit_type, unit_price, purchase_price, match_status, match_confidence
10. `parse_history` — message_id, parse_method, llm_model, raw_output JSON, parsed_items JSON, token_usage JSON, is_correct
11. `notification_logs` — event_type, related_id, channel, recipient, message TEXT, status, sent_at
12. `kpis_reports` — order_item_id, report_status (pending/reported/confirmed), reported_at, reference_number
13. `sales_reports` — report_period, order_id, supplier_name, hospital_name, product_name, quantity, standard_code, business_number

Include indexes on: hospitals(name), products(category), product_aliases(hospital_id, alias_normalized), raw_messages(parse_status), orders(order_date, hospital_id, status), order_items(order_id), kpis_reports(report_status).

Exact column definitions per `notiflow_nocodb_dev_plan_v3.1.md` sections 3.2.1–3.2.13.

**Step 2: Verify schema loads without errors**

```bash
docker compose up -d postgres
docker compose exec postgres psql -U notiflow -d notiflow_db -f /docker-entrypoint-initdb.d/init-db.sql
```

Expected: All CREATE TABLE and CREATE INDEX succeed with no errors.

**Step 3: Commit**

```bash
git add scripts/init-db.sql
git commit -m "feat: add PostgreSQL v3.1 schema with 13 tables"
```

---

### Task 3: Write Caddyfile and Makefile

**Files:**
- Create: `notiflow-order-system/Caddyfile`
- Create: `notiflow-order-system/Makefile`

**Step 1: Write Caddyfile**

```
{$DOMAIN:localhost} {
    handle /api/* {
        reverse_proxy api-gateway:3000
    }
    handle /nocodb/* {
        reverse_proxy nocodb:8080
    }
    handle {
        reverse_proxy nocodb:8080
    }
}
```

**Step 2: Write Makefile**

Targets: `up`, `down`, `dev`, `logs`, `db-shell`, `redis-shell`, `import`, `backup`, `restore`, `test`.

**Step 3: Commit**

```bash
git add Caddyfile Makefile
git commit -m "chore: add Caddyfile and Makefile shortcuts"
```

---

### Task 4: Initialize API Gateway Node.js project

**Files:**
- Create: `notiflow-order-system/api-gateway/package.json`
- Create: `notiflow-order-system/api-gateway/Dockerfile`
- Create: `notiflow-order-system/api-gateway/Dockerfile.dev`
- Create: `notiflow-order-system/api-gateway/src/index.js`
- Create: `notiflow-order-system/api-gateway/src/config/index.js`
- Create: `notiflow-order-system/api-gateway/src/routes/health.js`

**Step 1: Write package.json**

Dependencies: express, cors, helmet, dotenv, axios (NocoDB client), ioredis, @anthropic-ai/sdk, fuse.js, xlsx, pdfkit, node-telegram-bot-api, winston, joi.
DevDependencies: jest, nodemon, supertest.

**Step 2: Write Dockerfile (production)**

FROM node:22-alpine, WORKDIR /app, COPY package*.json, RUN npm ci --production, COPY src/, CMD node src/index.js.

**Step 3: Write Dockerfile.dev**

FROM node:22-alpine, WORKDIR /app, COPY package*.json, RUN npm install, CMD npx nodemon src/index.js.

**Step 4: Write src/config/index.js**

Load all env vars with defaults. Export config object.

**Step 5: Write src/index.js**

Express app: cors, helmet, json parser, health route, error handler. Listen on config.port (3000).

**Step 6: Write src/routes/health.js**

GET /health → { status: 'ok', version: '3.1.0', timestamp }.

**Step 7: Run test**

```bash
cd api-gateway && npm install && node src/index.js &
curl http://localhost:3000/health
```

Expected: `{"status":"ok","version":"3.1.0",...}`

**Step 8: Commit**

```bash
git add api-gateway/
git commit -m "feat: initialize Express API Gateway with health endpoint"
```

---

### Task 5: Copy Excel data files to scripts/data

**Files:**
- Copy: `발주서_v2.2.xlsx` → `notiflow-order-system/scripts/data/발주서_v2.2.xlsx`
- Copy: `이한규내과 데이타.xlsx` → `notiflow-order-system/scripts/data/이한규내과 데이타.xlsx`

**Step 1: Copy files**

```bash
cp "발주서_v2.2.xlsx" notiflow-order-system/scripts/data/
cp "이한규내과 데이타.xlsx" notiflow-order-system/scripts/data/
```

**Step 2: Commit**

```bash
git add scripts/data/
git commit -m "chore: add Excel source data for import"
```

---

### Task 6: Write Excel import — supplier parser

**Files:**
- Create: `notiflow-order-system/scripts/parsers/supplierParser.js`
- Test: `notiflow-order-system/scripts/parsers/__tests__/supplierParser.test.js`

**Step 1: Write the failing test**

```javascript
const { parseSuppliers } = require('../supplierParser');

describe('supplierParser', () => {
  test('extracts unique supplier names from known list', () => {
    const result = parseSuppliers();
    expect(result.length).toBeGreaterThanOrEqual(10);
    expect(result.map(s => s.name)).toContain('보령제약');
    expect(result.map(s => s.name)).toContain('니프로코리아');
    expect(result.map(s => s.short_name)).toContain('보령');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd scripts && npx jest parsers/__tests__/supplierParser.test.js -v
```

Expected: FAIL — module not found.

**Step 3: Write supplierParser.js**

Since suppliers aren't in a single clean column, use a hardcoded master list derived from the analysis (보령제약/보령, 알보젠코리아/알보젠, 니프로코리아/니프로, etc. — 11 suppliers from design doc section 2.4). Return `[{ name, short_name, contact_info: {}, notes: '' }]`.

**Step 4: Run test to verify it passes**

```bash
npx jest parsers/__tests__/supplierParser.test.js -v
```

Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/parsers/supplierParser.js scripts/parsers/__tests__/
git commit -m "feat: add supplier parser with 11 known suppliers"
```

---

### Task 7: Write Excel import — hospital parser

**Files:**
- Create: `notiflow-order-system/scripts/parsers/hospitalParser.js`
- Test: `notiflow-order-system/scripts/parsers/__tests__/hospitalParser.test.js`

**Step 1: Write the failing test**

```javascript
const { parseHospitals } = require('../hospitalParser');

describe('hospitalParser', () => {
  test('parses 41 hospitals from 01_병원목록 sheet', () => {
    const result = parseHospitals('scripts/data/발주서_v2.2.xlsx');
    expect(result.length).toBe(41);
    expect(result[0]).toHaveProperty('name');
    expect(result[0]).toHaveProperty('hospital_type');
    expect(result[0]).toHaveProperty('business_number');
  });

  test('maps hospital types correctly', () => {
    const result = parseHospitals('scripts/data/발주서_v2.2.xlsx');
    const types = [...new Set(result.map(h => h.hospital_type))];
    expect(types).toEqual(expect.arrayContaining(['hospital', 'clinic']));
  });
});
```

**Step 2: Run test to verify it fails**

**Step 3: Write hospitalParser.js**

Use xlsx library. Read sheet `01_병원목록_신규 포함`. Columns: No(A), 병원명(B), 유형(C), 주소(D), 전화번호(E), 담당자(F), 담당자 연락처(G), 결제조건(H), 거래시작일(I), 비고(J), 사업자등록번호(K).

Map 유형 values to hospital_type codes: 병원→hospital, 의원→clinic, 약국/약품→pharmacy, 유통→distributor, 대학/연구→research, else→other.

Return array of hospital objects.

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```bash
git add scripts/parsers/hospitalParser.js scripts/parsers/__tests__/hospitalParser.test.js
git commit -m "feat: add hospital parser for 41 hospitals from Excel"
```

---

### Task 8: Write Excel import — product parser

**Files:**
- Create: `notiflow-order-system/scripts/parsers/productParser.js`
- Test: `notiflow-order-system/scripts/parsers/__tests__/productParser.test.js`

**Step 1: Write the failing test**

```javascript
const { parseProducts } = require('../productParser');

describe('productParser', () => {
  test('parses 628 products from 02_품목_New sheet', () => {
    const result = parseProducts('scripts/data/발주서_v2.2.xlsx');
    expect(result.length).toBe(628);
  });

  test('each product has required fields', () => {
    const result = parseProducts('scripts/data/발주서_v2.2.xlsx');
    expect(result[0]).toHaveProperty('official_name');
    expect(result[0]).toHaveProperty('short_name');
    expect(result[0]).toHaveProperty('category');
    expect(result[0]).toHaveProperty('manufacturer');
  });
});
```

**Step 2: Run test to verify it fails**

**Step 3: Write productParser.js**

Read sheet `02_품목_New`. Columns: No(A), 실제 의약품/의료용품명(B)→official_name, 품목(C)→short_name/name, 분류(D)→category, 성분명(E)→ingredient, 효능/효과(F)→efficacy, 제조사(G)→manufacturer.

Map category values using keyword matching (다이알라이저→dialyzer, 혈액라인→blood_line, etc.).

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```bash
git add scripts/parsers/productParser.js scripts/parsers/__tests__/productParser.test.js
git commit -m "feat: add product parser for 628 products from Excel"
```

---

### Task 9: Write Excel import — alias parser (global)

**Files:**
- Create: `notiflow-order-system/scripts/parsers/aliasParser.js`
- Test: `notiflow-order-system/scripts/parsers/__tests__/aliasParser.test.js`

**Step 1: Write the failing test**

```javascript
const { parseAliases } = require('../aliasParser');

describe('aliasParser', () => {
  test('parses 1033 alias mappings from 통합_raw sheet', () => {
    const result = parseAliases('scripts/data/발주서_v2.2.xlsx');
    expect(result.length).toBe(1033);
  });

  test('each alias has hospital_name, alias, and product_name', () => {
    const result = parseAliases('scripts/data/발주서_v2.2.xlsx');
    expect(result[0]).toHaveProperty('hospital_name');
    expect(result[0]).toHaveProperty('alias');
    expect(result[0]).toHaveProperty('product_name');
  });
});
```

**Step 2: Run test to verify it fails**

**Step 3: Write aliasParser.js**

Read sheet `통합_raw`. Columns: 병원명(A), 품목_기존(B)→alias, 매칭_병원명(C), 실제_제품명(D)→product_name.

Normalize alias: trim, lowercase Korean unchanged, remove extra whitespace. Set `alias_normalized`.

Note: These will be imported as hospital-specific aliases (hospital_id will be resolved by name lookup during import). Aliases where hospital is ambiguous or ALL → set hospital_id=NULL (global).

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```bash
git add scripts/parsers/aliasParser.js scripts/parsers/__tests__/aliasParser.test.js
git commit -m "feat: add alias parser for 1033 mappings from Excel"
```

---

### Task 10: Write Excel import — KakaoTalk alias parser (hospital-specific)

**Files:**
- Create: `notiflow-order-system/scripts/parsers/kakaoAliasParser.js`
- Test: `notiflow-order-system/scripts/parsers/__tests__/kakaoAliasParser.test.js`

**Step 1: Write the failing test**

```javascript
const { parseKakaoAliases } = require('../kakaoAliasParser');

describe('kakaoAliasParser', () => {
  test('parses hospital-specific aliases from 이한규내과 데이타', () => {
    const result = parseKakaoAliases('scripts/data/이한규내과 데이타.xlsx');
    expect(result.length).toBeGreaterThan(5);
    expect(result.find(a => a.alias === 'b')).toBeDefined();
    expect(result.find(a => a.alias === 'b').product_name).toContain('헤모시스비액');
  });

  test('all aliases belong to 이한규내과', () => {
    const result = parseKakaoAliases('scripts/data/이한규내과 데이타.xlsx');
    result.forEach(a => {
      expect(a.hospital_name).toBe('이한규내과');
    });
  });
});
```

**Step 2–5: Implement, test, commit**

Read column I (카카오톡 발주명) paired with product name column. Hospital = "이한규내과" for all.

```bash
git commit -m "feat: add KakaoTalk alias parser for hospital-specific aliases"
```

---

### Task 11: Write Excel import — box spec parser

**Files:**
- Create: `notiflow-order-system/scripts/parsers/boxSpecParser.js`
- Test: `notiflow-order-system/scripts/parsers/__tests__/boxSpecParser.test.js`

**Step 1: Write the failing test**

```javascript
const { parseBoxSpecs } = require('../boxSpecParser');

describe('boxSpecParser', () => {
  test('extracts box specs from product data', () => {
    const result = parseBoxSpecs();
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('product_name');
    expect(result[0]).toHaveProperty('qty_per_box');
  });
});
```

**Step 2–5: Implement, test, commit**

Hardcoded known box specs from analysis: EK-13H=24, EK-15H=24, Supercath=100, 혈액회로HD=24. Parse product names for patterns like `24EA/BOX`.

```bash
git commit -m "feat: add box spec parser"
```

---

### Task 12: Write main import orchestrator

**Files:**
- Create: `notiflow-order-system/scripts/import-excel.js`

**Step 1: Write import-excel.js**

Orchestrates the full import in order:
1. Connect to PostgreSQL (via `pg` library or NocoDB API)
2. Parse & insert suppliers (supplierParser)
3. Parse & insert hospitals (hospitalParser)
4. Parse & insert products (productParser)
5. Parse & insert product_suppliers (link by name)
6. Parse & insert product_aliases global (aliasParser) — resolve hospital_id and product_id by name
7. Parse & insert product_aliases hospital-specific (kakaoAliasParser) — resolve IDs
8. Parse & insert product_box_specs (boxSpecParser) — resolve product_id
9. Print summary: counts per table

Use transactions. Add `--dry-run` flag for testing without DB writes.

**Step 2: Test with dry-run**

```bash
node scripts/import-excel.js --dry-run
```

Expected: Summary output with counts (11 suppliers, 41 hospitals, 628 products, 1033+ aliases, N box specs).

**Step 3: Test with actual DB**

```bash
docker compose up -d postgres
node scripts/import-excel.js
```

Expected: All data inserted. Verify with `psql` queries.

**Step 4: Commit**

```bash
git add scripts/import-excel.js
git commit -m "feat: add Excel import orchestrator with full data pipeline"
```

---

### Task 13: Write import validation script

**Files:**
- Create: `notiflow-order-system/scripts/validate-import.js`

**Step 1: Write validate-import.js**

Connect to DB and verify:
- `SELECT COUNT(*) FROM suppliers` = 11+
- `SELECT COUNT(*) FROM hospitals` = 41
- `SELECT COUNT(*) FROM products` = 628
- `SELECT COUNT(*) FROM product_aliases` = 1033+
- `SELECT COUNT(*) FROM product_aliases WHERE hospital_id IS NOT NULL` > 0
- Spot-check: 이한규내과 alias "b" → 헤모시스비액
- Spot-check: product "혈액투석여과기 EK-13H" exists with category "dialyzer"

**Step 2: Run validation**

```bash
node scripts/validate-import.js
```

Expected: All checks PASS.

**Step 3: Commit**

```bash
git add scripts/validate-import.js
git commit -m "feat: add import validation script"
```

---

### Task 14: Bring up full Docker stack and verify

**Step 1: Start all services**

```bash
docker compose up -d
```

**Step 2: Verify each service**

```bash
curl http://localhost:3000/health          # API Gateway
curl http://localhost:8080/api/v1/health   # NocoDB
docker compose exec redis redis-cli ping   # Redis → PONG
docker compose exec postgres psql -U notiflow -d notiflow_db -c "SELECT COUNT(*) FROM hospitals"  # → 41
```

**Step 3: Run Excel import against running DB**

```bash
docker compose exec api-gateway node /app/scripts/import-excel.js
docker compose exec api-gateway node /app/scripts/validate-import.js
```

**Step 4: Commit any adjustments**

```bash
git commit -m "chore: verify full Docker stack with imported data"
```

---

## Phase 2: API Gateway Core Development (Weeks 2-3)

### Task 15: Write NocoDB client service

**Files:**
- Create: `notiflow-order-system/api-gateway/src/services/nocodbClient.js`
- Test: `notiflow-order-system/api-gateway/tests/nocodbClient.test.js`

**Step 1: Write the failing test**

```javascript
describe('nocodbClient', () => {
  test('list() returns records from a table', async () => {
    const client = require('../src/services/nocodbClient');
    const hospitals = await client.list('hospitals', { limit: 5 });
    expect(hospitals).toHaveProperty('list');
  });
});
```

**Step 2: Write nocodbClient.js**

Wrapper around NocoDB REST API v2 using axios:
- `list(table, params)` — GET /api/v2/tables/{tableId}/records
- `get(table, id)` — GET /api/v2/tables/{tableId}/records/{id}
- `create(table, data)` — POST /api/v2/tables/{tableId}/records
- `update(table, id, data)` — PATCH /api/v2/tables/{tableId}/records/{id}
- `findOne(table, where)` — GET with where filter

Cache table name→tableId mapping on first call.

**Step 3: Run test, verify pass**

**Step 4: Commit**

```bash
git commit -m "feat: add NocoDB REST API client wrapper"
```

---

### Task 16: Write Redis client service

**Files:**
- Create: `notiflow-order-system/api-gateway/src/services/redisClient.js`
- Test: `notiflow-order-system/api-gateway/tests/redisClient.test.js`

**Step 1: Write the failing test**

```javascript
describe('redisClient', () => {
  test('set and get a value', async () => {
    const redis = require('../src/services/redisClient');
    await redis.set('test:key', 'value', 60);
    const result = await redis.get('test:key');
    expect(result).toBe('value');
  });
});
```

**Step 2: Write redisClient.js**

Thin wrapper around ioredis. Methods: `get(key)`, `set(key, value, ttlSeconds)`, `del(key)`, `getJson(key)`, `setJson(key, obj, ttl)`.

**Step 3: Run test, verify pass**

**Step 4: Commit**

```bash
git commit -m "feat: add Redis client wrapper"
```

---

### Task 17: Write auth middleware

**Files:**
- Create: `notiflow-order-system/api-gateway/src/middleware/auth.js`
- Test: `notiflow-order-system/api-gateway/tests/middleware/auth.test.js`

**Step 1: Write the failing test**

```javascript
const request = require('supertest');
const app = require('../src/index');

describe('auth middleware', () => {
  test('rejects requests without API key', async () => {
    const res = await request(app).post('/api/v1/messages').send({});
    expect(res.status).toBe(401);
  });

  test('accepts requests with valid API key', async () => {
    const res = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${process.env.API_KEY}`)
      .send({ source_app: 'test', content: 'test' });
    expect(res.status).not.toBe(401);
  });
});
```

**Step 2: Write auth.js**

Check `Authorization: Bearer {API_KEY}` header against `config.apiKey`. Return 401 if missing/invalid.

**Step 3: Run test, verify pass**

**Step 4: Commit**

```bash
git commit -m "feat: add API key auth middleware"
```

---

### Task 18: Write rate limiter middleware

**Files:**
- Create: `notiflow-order-system/api-gateway/src/middleware/rateLimiter.js`
- Test: `notiflow-order-system/api-gateway/tests/middleware/rateLimiter.test.js`

**Step 1: Write the failing test**

```javascript
describe('rateLimiter', () => {
  test('allows requests under limit', async () => {
    // Send 5 requests, all should succeed
  });

  test('blocks requests over limit', async () => {
    // Send 101 requests, last should get 429
  });
});
```

**Step 2: Write rateLimiter.js**

Redis-based sliding window. Default: 100 req/min per API key.

**Step 3: Run test, verify pass**

**Step 4: Commit**

```bash
git commit -m "feat: add Redis-based rate limiter middleware"
```

---

### Task 19: Write message receive endpoint

**Files:**
- Create: `notiflow-order-system/api-gateway/src/routes/messages.js`
- Create: `notiflow-order-system/api-gateway/src/middleware/validator.js`
- Test: `notiflow-order-system/api-gateway/tests/routes/messages.test.js`

**Step 1: Write the failing test**

```javascript
describe('POST /api/v1/messages', () => {
  test('saves message to raw_messages and returns message_id', async () => {
    const res = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${API_KEY}`)
      .send({
        source_app: 'kakaotalk',
        sender: '이한규내과',
        content: 'EK15 10박스',
        received_at: '2026-02-13T09:30:00+09:00'
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message_id');
    expect(res.body.success).toBe(true);
  });

  test('rejects invalid payload', async () => {
    const res = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${API_KEY}`)
      .send({ source_app: 'kakaotalk' }); // missing content
    expect(res.status).toBe(400);
  });
});
```

**Step 2: Write validator.js**

Joi schema: source_app (required string), sender (optional string), content (required string), received_at (required ISO date string), device_id (optional string).

**Step 3: Write routes/messages.js**

POST /api/v1/messages:
1. Validate request body
2. Save to raw_messages via nocodbClient (parse_status='pending')
3. Trigger async processing pipeline (hospitalResolver → aiParser → productMatcher → orderGenerator)
4. Return response with message_id and processing result

Initially just implement steps 1-2, return `{ success: true, message_id, parse_status: 'pending' }`. Pipeline will be wired in later tasks.

**Step 4: Register route in src/index.js**

**Step 5: Run test, verify pass**

**Step 6: Commit**

```bash
git commit -m "feat: add message receive endpoint with validation"
```

---

### Task 20: Write hospital resolver (app name + sender name matching)

**Files:**
- Create: `notiflow-order-system/api-gateway/src/services/hospitalResolver.js`
- Test: `notiflow-order-system/api-gateway/tests/hospitalResolver.test.js`

**Step 1: Write the failing test**

```javascript
const { HospitalResolver } = require('../src/services/hospitalResolver');

describe('hospitalResolver', () => {
  let resolver;

  beforeAll(async () => {
    resolver = new HospitalResolver(mockNocodbClient, mockRedisClient);
  });

  test('resolves hospital by KakaoTalk sender name', async () => {
    const result = await resolver.resolve('kakaotalk', '이한규내과');
    expect(result.hospital_id).toBe(38);
    expect(result.method).toBe('kakao_sender');
  });

  test('resolves hospital by SMS phone number', async () => {
    const result = await resolver.resolve('sms', '010-1234-5678');
    expect(result.hospital_id).toBeDefined();
    expect(result.method).toBe('phone');
  });

  test('returns null for unknown sender', async () => {
    const result = await resolver.resolve('kakaotalk', '알수없는사람');
    expect(result.hospital_id).toBeNull();
    expect(result.method).toBe('unmatched');
  });

  test('uses Redis cache on second call', async () => {
    await resolver.resolve('kakaotalk', '이한규내과');
    await resolver.resolve('kakaotalk', '이한규내과');
    // Redis get should have been called
    expect(mockRedisClient.get).toHaveBeenCalled();
  });
});
```

**Step 2: Write hospitalResolver.js**

```
resolve(sourceApp, sender):
  1. Check Redis cache: `hospital:${sourceApp}:${normalize(sender)}`
  2. If cached → return
  3. If sourceApp === 'kakaotalk':
     → Query hospitals where kakao_sender_names contains sender
     → Try exact match, then normalized match
  4. If sourceApp === 'sms':
     → Query hospitals where contact_phones contains sender
  5. If no match → fuzzy match against hospital names (fuse.js, threshold 0.8)
  6. If still no match → return { hospital_id: null, method: 'unmatched' }
  7. Cache result in Redis (TTL: 1 hour)
  8. Return { hospital_id, hospital_name, method }
```

**Step 3: Run test, verify pass**

**Step 4: Commit**

```bash
git commit -m "feat: add hospital resolver with KakaoTalk sender matching"
```

---

### Task 21: Write regex parser

**Files:**
- Create: `notiflow-order-system/api-gateway/src/services/regexParser.js`
- Test: `notiflow-order-system/api-gateway/tests/regexParser.test.js`

**Step 1: Write the failing test**

```javascript
const { RegexParser } = require('../src/services/regexParser');

describe('regexParser', () => {
  const parser = new RegexParser();

  test('parses "EK15 10박스"', () => {
    const result = parser.parse('EK15 10박스');
    expect(result).toEqual([{ item: 'EK15', qty: 10, unit: 'box' }]);
  });

  test('parses multiline order', () => {
    const result = parser.parse('EK13 3박스\n라인 5박스\n트리캅 1박스');
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ item: 'EK13', qty: 3, unit: 'box' });
  });

  test('parses "니들 50개"', () => {
    const result = parser.parse('니들 50개');
    expect(result).toEqual([{ item: '니들', qty: 50, unit: 'piece' }]);
  });

  test('defaults qty to 1 when not specified', () => {
    const result = parser.parse('솔카트');
    expect(result).toEqual([{ item: '솔카트', qty: 1, unit: 'piece' }]);
  });

  test('returns empty array for non-order messages', () => {
    const result = parser.parse('감사합니다. 좋은 하루 되세요.');
    expect(result).toEqual([]);
  });
});
```

**Step 2: Write regexParser.js**

Pattern per line: `/([\w가-힣A-Za-z\-\/\s]+?)\s*(\d+)\s*(박스|box|bx|개|ea|팩|pack)?/gi`

Handle unit mapping: 박스/box/bx→box, 개/ea/piece→piece, default→piece.

**Step 3: Run test, verify pass**

**Step 4: Commit**

```bash
git commit -m "feat: add regex parser for order message fallback"
```

---

### Task 22: Write AI parser (Claude API integration)

**Files:**
- Create: `notiflow-order-system/api-gateway/src/services/aiParser.js`
- Create: `notiflow-order-system/api-gateway/src/config/prompts.js`
- Test: `notiflow-order-system/api-gateway/tests/aiParser.test.js`

**Step 1: Write prompts.js**

Export `buildParsePrompt(hospitalName, aliases, recentOrders, message)` that builds the LLM prompt per design doc section 5.1.2. Include hospital-specific alias list and recent order history.

**Step 2: Write the failing test**

```javascript
const { AiParser } = require('../src/services/aiParser');

describe('aiParser', () => {
  test('parses order message using Claude API', async () => {
    const parser = new AiParser(config);
    const result = await parser.parse(
      'EK15 10박스 니들 50개',
      { hospitalName: '이한규내과', aliases: mockAliases }
    );
    expect(result.items).toHaveLength(2);
    expect(result.items[0].item).toBe('EK15');
    expect(result.method).toBe('llm');
  });

  test('falls back to regex on API error', async () => {
    const parser = new AiParser({ ...config, claudeApiKey: 'invalid' });
    const result = await parser.parse('EK15 10박스', {});
    expect(result.method).toBe('regex');
  });
});
```

**Step 3: Write aiParser.js**

```
parse(message, context):
  1. Build prompt with hospital context (aliases, recent orders)
  2. Call Claude API (claude-haiku-4-5) with JSON output mode
  3. Parse response JSON
  4. Log to parse_history (model, tokens, latency)
  5. If API fails → fallback to regexParser.parse()
  6. Return { items, method: 'llm'|'regex', latency_ms, token_usage }
```

**Step 4: Run test, verify pass**

**Step 5: Commit**

```bash
git commit -m "feat: add AI parser with Claude API and regex fallback"
```

---

### Task 23: Write message classifier

**Files:**
- Create: `notiflow-order-system/api-gateway/src/services/messageClassifier.js`
- Test: `notiflow-order-system/api-gateway/tests/messageClassifier.test.js`

**Step 1: Write the failing test**

```javascript
describe('messageClassifier', () => {
  test('classifies order messages', () => {
    expect(classify('EK15 10박스')).toBe(true);
    expect(classify('b 20 G 20')).toBe(true);
  });

  test('classifies non-order messages', () => {
    expect(classify('감사합니다')).toBe(false);
    expect(classify('내일 회의 가능하신가요?')).toBe(false);
  });
});
```

**Step 2: Write messageClassifier.js**

Heuristic-first approach:
- Contains number + Korean unit word (박스, 개, 팩) → likely order
- Contains known product keywords → likely order
- Very short messages with alphanumeric codes → likely order
- Greeting/question patterns → not order
- Fallback: pass to LLM if uncertain

**Step 3: Run test, verify pass**

**Step 4: Commit**

```bash
git commit -m "feat: add message classifier (order vs non-order)"
```

---

### Task 24: Write product matcher (hospital-specific alias engine)

**Files:**
- Create: `notiflow-order-system/api-gateway/src/services/productMatcher.js`
- Test: `notiflow-order-system/api-gateway/tests/productMatcher.test.js`

**Step 1: Write the failing test**

```javascript
const { ProductMatcher } = require('../src/services/productMatcher');

describe('productMatcher', () => {
  let matcher;

  beforeAll(async () => {
    matcher = new ProductMatcher(mockNocodbClient, mockRedisClient);
  });

  // Hospital-specific exact match
  test('matches "b" to 헤모시스비액 at 이한규내과', async () => {
    const result = await matcher.match('b', 38); // hospital_id=38
    expect(result.product_name).toContain('헤모시스비액');
    expect(result.confidence).toBe(1.0);
    expect(result.method).toBe('hospital_alias');
  });

  // Global exact match
  test('matches "솔카트" globally', async () => {
    const result = await matcher.match('솔카트', null);
    expect(result.product_name).toContain('솔카트');
    expect(result.confidence).toBe(0.95);
    expect(result.method).toBe('global_alias');
  });

  // Fuzzy match
  test('fuzzy matches "이케이13" to EK-13H', async () => {
    const result = await matcher.match('이케이13', 38);
    expect(result.product_name).toContain('EK-13');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  // Unmatched
  test('returns unmatched for unknown text', async () => {
    const result = await matcher.match('알수없는품목', 38);
    expect(result.match_status).toBe('unmatched');
  });
});
```

**Step 2: Write productMatcher.js**

Matching priority chain per design doc section 5.2:
1. Hospital-specific exact: `WHERE hospital_id=? AND alias_normalized=?` → confidence 1.0
2. Global exact: `WHERE hospital_id IS NULL AND alias_normalized=?` → confidence 0.95
3. Contains: `WHERE alias LIKE '%text%'` → confidence 0.8-0.95
4. Fuzzy (fuse.js): Search product names + aliases → confidence 0.5-0.8
5. Unmatched: `match_status='unmatched'`

Redis cache: `product:match:{hospital_id}:{normalized_text}` with TTL 1h.

**Step 3: Run test, verify pass**

**Step 4: Commit**

```bash
git commit -m "feat: add product matcher with hospital-specific alias priority"
```

---

### Task 25: Write supplier service

**Files:**
- Create: `notiflow-order-system/api-gateway/src/services/supplierService.js`
- Test: `notiflow-order-system/api-gateway/tests/supplierService.test.js`

**Step 1: Write the failing test**

```javascript
describe('supplierService', () => {
  test('returns primary supplier for a product', async () => {
    const result = await supplierService.getPrimarySupplier(productId);
    expect(result).toHaveProperty('supplier_id');
    expect(result).toHaveProperty('purchase_price');
  });

  test('returns null when no supplier linked', async () => {
    const result = await supplierService.getPrimarySupplier(9999);
    expect(result).toBeNull();
  });
});
```

**Step 2: Write supplierService.js**

- `getPrimarySupplier(productId)` → query product_suppliers WHERE product_id=? AND is_primary=true
- `getSuppliers(productId)` → all suppliers for a product
- Cache in Redis

**Step 3: Run test, verify pass**

**Step 4: Commit**

```bash
git commit -m "feat: add supplier service for product-supplier lookup"
```

---

### Task 26: Write order generator

**Files:**
- Create: `notiflow-order-system/api-gateway/src/services/orderGenerator.js`
- Test: `notiflow-order-system/api-gateway/tests/orderGenerator.test.js`

**Step 1: Write the failing test**

```javascript
describe('orderGenerator', () => {
  test('creates order with items and supplier linkage', async () => {
    const matchedItems = [
      { product_id: 28, product_name: 'EK-15H', quantity: 10, unit: 'box', confidence: 1.0, original_text: 'EK15 10박스' },
      { product_id: 9, product_name: 'AVF NEEDLE 16G', quantity: 50, unit: 'piece', confidence: 1.0, original_text: '니들 50개' }
    ];
    const result = await orderGenerator.create(38, matchedItems, messageId);
    expect(result).toHaveProperty('order_id');
    expect(result).toHaveProperty('order_number');
    expect(result.order_number).toMatch(/^ORD-\d{8}-\d{3}$/);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].supplier_id).toBeDefined();
  });

  test('calculates supply_amount and tax_amount', async () => {
    const result = await orderGenerator.create(38, itemsWithPrices, messageId);
    expect(result.supply_amount).toBeGreaterThan(0);
    expect(result.tax_amount).toBe(Math.round(result.supply_amount * 0.1));
  });
});
```

**Step 2: Write orderGenerator.js**

Per design doc section 5.4:
1. Generate order_number (ORD-YYYYMMDD-NNN)
2. Create orders record (hospital_id, order_date, status='draft', delivery_date)
3. For each matched item:
   - Lookup primary supplier → supplier_id
   - Lookup box spec → calculated_pieces
   - Calculate line_total
   - Create order_items record
4. Update orders: total_items, total_amount, supply_amount, tax_amount
5. Update raw_messages: parse_status='parsed', order_id

**Step 3: Run test, verify pass**

**Step 4: Commit**

```bash
git commit -m "feat: add order generator with supplier linkage and price calc"
```

---

### Task 27: Wire up the full processing pipeline

**Files:**
- Modify: `notiflow-order-system/api-gateway/src/routes/messages.js`
- Test: `notiflow-order-system/api-gateway/tests/integration/e2e.test.js`

**Step 1: Write the E2E test**

```javascript
describe('E2E: message → order', () => {
  test('full pipeline: KakaoTalk message → hospital → parse → match → order', async () => {
    const res = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${API_KEY}`)
      .send({
        source_app: 'kakaotalk',
        sender: '이한규내과',
        content: 'EK15 10박스 니들 50개',
        received_at: '2026-02-13T09:30:00+09:00'
      });

    expect(res.body.success).toBe(true);
    expect(res.body.hospital).toBe('이한규내과');
    expect(res.body.order_id).toBeDefined();
    expect(res.body.matched_items).toHaveLength(2);
    expect(res.body.matched_items[0].product).toContain('EK-15H');
    expect(res.body.matched_items[0].supplier).toBeDefined();
  });
});
```

**Step 2: Wire pipeline in messages.js**

POST /api/v1/messages:
1. Validate & save raw_messages
2. `hospitalResolver.resolve(source_app, sender)` → hospital_id
3. `messageClassifier.classify(content)` → if not order, mark skipped
4. `aiParser.parse(content, { hospitalName, aliases })` → parsed items
5. For each item: `productMatcher.match(item, hospital_id)` → matched items
6. `orderGenerator.create(hospital_id, matchedItems, messageId)` → order
7. Return full response

**Step 3: Run E2E test**

```bash
npx jest tests/integration/e2e.test.js -v
```

**Step 4: Commit**

```bash
git commit -m "feat: wire full message processing pipeline end-to-end"
```

---

### Task 28: Write error handler and logger

**Files:**
- Create: `notiflow-order-system/api-gateway/src/middleware/errorHandler.js`
- Create: `notiflow-order-system/api-gateway/src/utils/logger.js`

**Step 1: Write logger.js**

Winston logger with JSON format, console + file transports. Levels: error, warn, info, debug.

**Step 2: Write errorHandler.js**

Express error middleware. Log error, return JSON response with error code. Don't leak stack traces in production.

**Step 3: Register in src/index.js**

**Step 4: Commit**

```bash
git commit -m "feat: add structured logging and error handling"
```

---

## Phase 3: Advanced Features + Automation (Week 4-5)

### Task 29: Write Telegram notification service

**Files:**
- Create: `notiflow-order-system/api-gateway/src/services/notificationService.js`
- Test: `notiflow-order-system/api-gateway/tests/notificationService.test.js`

Implements all notification types from design section 5.5: order_created, match_failed, hospital_unknown, kpis_reminder, delivery_today, anomaly_detected, daily_summary, system_error, parse_failed.

Uses Telegram Bot API. Saves to notification_logs table.

```bash
git commit -m "feat: add Telegram notification service with 9 event types"
```

---

### Task 30: Write PDF order generator

**Files:**
- Create: `notiflow-order-system/api-gateway/src/services/pdfGenerator.js`
- Create: `notiflow-order-system/templates/order-pdf.html`
- Test: `notiflow-order-system/api-gateway/tests/pdfGenerator.test.js`

Per design section 5.6: order number, dates, hospital info, items grouped by supplier, supply_amount + tax_amount + total.

```bash
git commit -m "feat: add PDF order generator with tax calculation"
```

---

### Task 31: Write NocoDB webhook handler

**Files:**
- Create: `notiflow-order-system/api-gateway/src/routes/webhooks.js`
- Test: `notiflow-order-system/api-gateway/tests/routes/webhooks.test.js`

Handle NocoDB webhook events:
- order_items.product_id manual update → trigger alias learning
- orders.status change → trigger notifications
- kpis_reports.report_status change → update tracking

```bash
git commit -m "feat: add NocoDB webhook handler for alias learning and status changes"
```

---

### Task 32: Write alias learning (manual match → auto-register)

**Files:**
- Modify: `notiflow-order-system/api-gateway/src/services/productMatcher.js`

When NocoDB webhook fires for manual product_id assignment on an unmatched order_item:
1. Extract original_text and hospital_id from order
2. INSERT into product_aliases (hospital_id, alias, product_id, source='learned')
3. Invalidate Redis cache for that hospital's aliases

```bash
git commit -m "feat: add alias auto-learning from manual matches"
```

---

### Task 33: Write KPIS tracking service

**Files:**
- Create: `notiflow-order-system/api-gateway/src/services/kpisService.js`
- Create: `notiflow-order-system/api-gateway/src/routes/reports.js`
- Test: `notiflow-order-system/api-gateway/tests/kpisService.test.js`

Per design section 5.8:
- Auto-create kpis_reports when order confirmed
- Update report_status via NocoDB/webhook
- Daily reminder for pending items (>7 days)

```bash
git commit -m "feat: add KPIS tracking service with auto-creation and reminders"
```

---

### Task 34: Write delivery management service

**Files:**
- Create: `notiflow-order-system/api-gateway/src/services/deliveryService.js`
- Create: `notiflow-order-system/api-gateway/src/routes/delivery.js`
- Test: `notiflow-order-system/api-gateway/tests/deliveryService.test.js`

Per design section 5.10:
- Auto-set delivery_date on order confirmation
- Morning Telegram alert for today's deliveries
- Delivery completion tracking

```bash
git commit -m "feat: add delivery management service with scheduling"
```

---

### Task 35: Write order/stats routes

**Files:**
- Create: `notiflow-order-system/api-gateway/src/routes/orders.js`
- Create: `notiflow-order-system/api-gateway/src/routes/stats.js`

Orders: GET list (filter by date/hospital/status), GET single, PATCH status, POST confirm.
Stats: GET daily/weekly/monthly parsing stats, success rates.

```bash
git commit -m "feat: add order management and stats API routes"
```

---

### Task 36: Configure NocoDB views

Manual step — configure via NocoDB web UI:
- All views per design doc section 7 (7.1-7.7)
- Hospital views: 전체 거래처, 활성 거래처, 유형별
- Product views: 전체 품목, 카테고리별, 병원별 별칭
- Supplier views: 전체 공급사, 품목별 공급사
- Order views: 오늘 주문, 주간, 월간, 칸반, 캘린더, 배송 캘린더
- KPIS views: 미신고, 신고완료
- Sales views: 월별 매출

Document the view configurations in `docs/NOCODB_VIEWS.md`.

```bash
git commit -m "docs: add NocoDB view configuration guide"
```

---

## Phase 4: NotiFlow Integration (Week 6)

### Task 37: Verify NotiFlow data format compatibility

**Files:**
- Test: `notiflow-order-system/api-gateway/tests/integration/notiflow-compat.test.js`

Test that the existing NotiFlow app's message format (from `mednoti_schema.sql` — captured_messages table with app_name, sender, content columns) maps correctly to our API's expected format.

```bash
git commit -m "test: verify NotiFlow message format compatibility"
```

---

### Task 38: Write Supabase migration script

**Files:**
- Create: `notiflow-order-system/scripts/migrate-supabase.js`

Read existing captured_messages from Supabase, transform to raw_messages format, insert into NocoDB. Skip duplicates.

```bash
git commit -m "feat: add Supabase to NocoDB migration script"
```

---

### Task 39: Write full E2E integration tests

**Files:**
- Modify: `notiflow-order-system/api-gateway/tests/integration/e2e.test.js`

Full flow tests per design section 12.3 (15 steps):
1. KakaoTalk message → API Gateway
2. Hospital identification by sender name
3. AI parsing with hospital context
4. Hospital-specific alias matching
5. Supplier auto-linkage
6. Order creation with pricing
7. Telegram notification
8. NocoDB data verification
9. Manual match → alias learning
10. PDF generation
11. KPIS record auto-creation

```bash
git commit -m "test: add comprehensive E2E integration tests"
```

---

### Task 40: Configure monitoring and backups

**Files:**
- Create: `notiflow-order-system/scripts/backup.sh`
- Create: `notiflow-order-system/scripts/restore.sh`

backup.sh: pg_dump + Redis RDB + timestamp. Cron daily at 3am.
restore.sh: Restore from backup file.

```bash
git commit -m "feat: add backup/restore scripts"
```

---

## Phase 5: Stabilization + Sales Reports (Weeks 7-8)

### Task 41: Write sales report service

**Files:**
- Create: `notiflow-order-system/api-gateway/src/services/salesReportService.js`
- Modify: `notiflow-order-system/api-gateway/src/routes/reports.js`
- Test: `notiflow-order-system/api-gateway/tests/salesReportService.test.js`

Per design section 5.9:
- `generateMonthlyReport(period)` → aggregate confirmed orders
- Auto-fill: supplier_name, hospital_name, product_name, qty, standard_code, address, business_number
- `GET /api/v1/reports/sales?period=2026-01`
- `GET /api/v1/reports/sales/export?period=2026-01&format=csv`

```bash
git commit -m "feat: add sales report generation with CSV export"
```

---

### Task 42: AI prompt tuning with real data

**Files:**
- Modify: `notiflow-order-system/api-gateway/src/config/prompts.js`
- Test: `notiflow-order-system/api-gateway/tests/aiParser.test.js`

Run all test messages from design section 12.1 against AI parser. Adjust prompt for:
- Single-character aliases ("b", "G")
- Mixed Korean/English codes ("EK13", "NV13")
- Implicit quantities
- Multi-line orders

Target: 95%+ parsing accuracy on test set.

```bash
git commit -m "feat: tune AI prompts for 95%+ accuracy on real data"
```

---

### Task 43: Performance optimization and load testing

**Step 1: Optimize Redis caching**

Ensure all hot paths use Redis:
- Hospital alias cache per hospital_id
- Product match cache
- Hospital resolver cache

**Step 2: Load test**

```bash
npx autocannon -c 10 -d 30 http://localhost:3000/api/v1/messages
```

Target: Handle 100 concurrent requests.

**Step 3: Commit**

```bash
git commit -m "perf: optimize caching and verify load handling"
```

---

### Task 44: Daily summary notification and docs

**Files:**
- Modify: `notiflow-order-system/api-gateway/src/services/notificationService.js`
- Create: `notiflow-order-system/docs/SETUP.md`
- Create: `notiflow-order-system/docs/API.md`

Add cron-like daily summary at 18:00: orders processed, success rate, unmatched items.

Write setup guide and API reference docs.

```bash
git commit -m "feat: add daily summary notification and documentation"
```

---

## Summary

| Phase | Tasks | Duration | Key Deliverables |
|-------|-------|----------|-----------------|
| 1 | Tasks 1-14 | 1 week | Docker, DB schema, Excel import (628 products, 41 hospitals, 1033 aliases) |
| 2 | Tasks 15-28 | 2 weeks | Full message→order pipeline with hospital-specific matching |
| 3 | Tasks 29-36 | 1.5 weeks | Telegram, PDF, KPIS, delivery, webhooks, alias learning |
| 4 | Tasks 37-40 | 1 week | NotiFlow integration, migration, E2E tests, monitoring |
| 5 | Tasks 41-44 | 1.5 weeks | Sales reports, AI tuning, load testing, documentation |

**Total: 44 tasks across 5 phases (~8 weeks)**
