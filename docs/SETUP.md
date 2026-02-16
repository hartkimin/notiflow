# NotiFlow Order System - Setup Guide

## Prerequisites

- Docker & Docker Compose
- Node.js 22+ (for local development)
- Git

## Quick Start

### 1. Clone & Configure

```bash
git clone <repository-url>
cd notiflow-order-system
cp .env.example .env
```

Edit `.env` with your values:

```env
# Required
POSTGRES_PASSWORD=your_secure_password
NOCODB_API_TOKEN=your_nocodb_token
API_KEY=your_api_key

# Optional
CLAUDE_API_KEY=your_claude_api_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
```

### 2. Start Services

```bash
docker compose up -d
```

This starts:
- **PostgreSQL 16** (port 5432) - Primary database
- **Redis 7** (port 6379) - Caching layer
- **NocoDB** (port 8080) - Web UI for data management
- **API Gateway** (port 3000) - Node.js application
- **Caddy** (port 80/443) - Reverse proxy with auto-HTTPS

### 3. Initialize Database

The database schema is auto-applied via `scripts/init-db.sql` on first startup.

### 4. Import Excel Data

```bash
cd api-gateway
npm install
node ../scripts/import-excel.js --file ../data/발주서_v2.2.xlsx
```

This imports hospitals, products, aliases, and supplier data.

### 5. Configure NocoDB

1. Open `http://localhost:8080`
2. Create an account and connect to the database
3. Generate an API token: **Settings > API Tokens**
4. Update `NOCODB_API_TOKEN` in `.env`

## Local Development

### API Gateway

```bash
cd api-gateway
npm install
npm run dev     # Start with hot reload
npm test        # Run tests
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_HOST` | No | localhost | PostgreSQL host |
| `POSTGRES_PORT` | No | 5432 | PostgreSQL port |
| `POSTGRES_USER` | No | notiflow | Database user |
| `POSTGRES_PASSWORD` | Yes | - | Database password |
| `POSTGRES_DB` | No | notiflow_db | Database name |
| `REDIS_URL` | No | redis://localhost:6379 | Redis connection URL |
| `NOCODB_URL` | No | http://localhost:8080 | NocoDB base URL |
| `NOCODB_API_TOKEN` | Yes | - | NocoDB API token |
| `API_KEY` | Yes | - | API authentication key |
| `CLAUDE_API_KEY` | No | - | Anthropic API key (for AI parsing) |
| `CLAUDE_MODEL` | No | claude-haiku-4-5-20251001 | Claude model for parsing |
| `TELEGRAM_BOT_TOKEN` | No | - | Telegram bot token |
| `TELEGRAM_CHAT_ID` | No | - | Telegram chat ID for notifications |
| `PORT` | No | 3000 | API Gateway port |

## Backup & Restore

### Backup (daily cron recommended)

```bash
# Manual backup
./scripts/backup.sh

# Cron job (daily 3 AM)
0 3 * * * /path/to/scripts/backup.sh
```

### Restore

```bash
./scripts/restore.sh /var/backups/notiflow/notiflow_backup_20260213_030000.tar.gz
```

## Architecture

```
NotiFlow App (Mobile)
        |
    [HTTPS/Caddy]
        |
  API Gateway (Node.js/Express)
   /    |     \         \
Redis  NocoDB  Claude   Telegram
  |      |      API      Bot
  |   PostgreSQL
  |      |
  (caching)
```

### Services

| Service | Port | Purpose |
|---------|------|---------|
| Caddy | 80/443 | Reverse proxy, auto-HTTPS |
| API Gateway | 3000 | Message processing pipeline |
| NocoDB | 8080 | Web UI, data management |
| PostgreSQL | 5432 | Primary data store |
| Redis | 6379 | Caching, rate limiting |

## Supabase Migration

To migrate existing data from Supabase:

```bash
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_KEY=your-anon-key \
NOCODB_URL=http://localhost:8080 \
NOCODB_TOKEN=your-token \
node scripts/migrate-supabase.js --dry-run
```

Remove `--dry-run` when ready to migrate.
