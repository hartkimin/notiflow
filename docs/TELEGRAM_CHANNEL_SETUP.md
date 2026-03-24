# NotiFlow × Telegram Channel 연동 실습 가이드

> 작성일: 2026-03-20
> 대상: NotiFlow 개발자
> 목적: Telegram을 통해 Claude Code에 개발 명령을 내리고, NotiFlow 프로젝트를 원격 관리

---

## 목차

1. [사전 준비](#1-사전-준비)
2. [Telegram 봇 생성](#2-telegram-봇-생성)
3. [Claude Code Channels 설정](#3-claude-code-channels-설정)
4. [페어링 및 보안 설정](#4-페어링-및-보안-설정)
5. [NotiFlow 개발에 활용하기](#5-notiflow-개발에-활용하기)
6. [고급: 커스텀 Webhook 채널 구축](#6-고급-커스텀-webhook-채널-구축)
7. [트러블슈팅](#7-트러블슈팅)

---

## 1. 사전 준비

### 필수 요구사항

```bash
# Claude Code 버전 확인 (v2.1.80 이상 필요)
claude --version

# Bun 런타임 설치 (채널 플러그인 실행에 필요)
curl -fsSL https://bun.sh/install | bash

# 설치 확인
bun --version
```

### 인증 요건

- **claude.ai 로그인** 필수 (Console/API 키 인증으로는 Channels 사용 불가)
- Team/Enterprise 플랜의 경우 조직 관리자가 Channels를 먼저 활성화해야 함
  - 경로: claude.ai → Admin settings → Claude Code → Channels → 활성화

---

## 2. Telegram 봇 생성

### Step 1: BotFather에서 봇 만들기

1. Telegram에서 [@BotFather](https://t.me/BotFather) 검색 후 대화 시작
2. `/newbot` 명령어 전송
3. 봇 이름 설정 (예: `NotiFlow Dev Assistant`)
4. 봇 유저네임 설정 — 반드시 `bot`으로 끝나야 함 (예: `notiflow_dev_bot`)
5. BotFather가 반환하는 **토큰을 복사** (형식: `123456789:AAHfiqksKZ8WrT...`)

```
예시 토큰: 7918273645:AAF3kP9xLmN2vBc8dEfGhIjKlMnOpQrStUv
           ↑ 숫자     ↑ 콜론  ↑ 문자열
           전체를 빠짐없이 복사해야 함
```

### Step 2: 봇 설명 설정 (선택)

BotFather에서 추가 설정:

```
/setdescription → NotiFlow 개발용 Claude Code 채널 봇
/setabouttext   → NotiFlow 프로젝트의 원격 개발 관리를 위한 AI 어시스턴트
```

---

## 3. Claude Code Channels 설정

### Step 1: NotiFlow 프로젝트 디렉토리에서 Claude Code 시작

```bash
cd ~/projects/notiflow    # NotiFlow 프로젝트 루트로 이동
claude                    # Claude Code 세션 시작
```

### Step 2: Telegram 플러그인 설치

Claude Code 세션 내에서:

```
/plugin install telegram@claude-plugins-official
```

> 마켓플레이스가 없다는 오류가 나면 먼저 실행:
> `/plugin marketplace add anthropics/claude-plugins-official`

### Step 3: 봇 토큰 구성

```
/telegram:configure 7918273645:AAF3kP9xLmN2vBc8dEfGhIjKlMnOpQrStUv
```

토큰이 저장되는 위치: `.claude/channels/telegram/.env`

```env
# .claude/channels/telegram/.env (자동 생성됨)
TELEGRAM_BOT_TOKEN=7918273645:AAF3kP9xLmN2vBc8dEfGhIjKlMnOpQrStUv
```

> **대안**: 셸 환경변수로 설정해도 됨 (우선순위가 더 높음)
> ```bash
> export TELEGRAM_BOT_TOKEN=7918273645:AAF3kP9xLmN2vBc8dEfGhIjKlMnOpQrStUv
> ```

### Step 4: 채널을 활성화하여 재시작

현재 세션을 종료하고, `--channels` 플래그와 함께 재시작:

```bash
claude --channels plugin:telegram@claude-plugins-official
```

이 시점부터 Telegram 봇이 메시지 수신을 시작한다.

---

## 4. 페어링 및 보안 설정

### Step 1: 페어링

1. **Telegram**에서 생성한 봇을 찾아 아무 메시지를 보냄 (예: "hello")
2. 봇이 **6자리 페어링 코드**를 회신함
3. **Claude Code 세션**으로 돌아가서:

```
/telegram:access pair A1B2C3
```

> 페어링 코드가 안 오면 `--channels` 플래그로 Claude Code가 실행 중인지 확인

### Step 2: 보안 정책 적용

페어링 완료 후, 반드시 allowlist 정책으로 전환하여 다른 사용자의 접근을 차단:

```
/telegram:access policy allowlist
```

### 보안 구조 요약

```
메시지 수신 흐름:

외부 사용자 → Telegram Bot
                  ↓
           Sender ID 확인
                  ↓
        ┌──── allowlist에 있음? ────┐
        │                           │
       Yes                         No
        ↓                           ↓
  Claude Code로              무시 (드롭)
    이벤트 전달
```

### 사용자 ID 확인 방법

Telegram 사용자 ID가 필요한 경우 [@userinfobot](https://t.me/userinfobot)에게 메시지를 보내면 숫자 ID를 알려줌.

---

## 5. NotiFlow 개발에 활용하기

채널이 설정되면, Telegram에서 Claude Code에 직접 명령을 보내 NotiFlow 프로젝트 작업을 수행할 수 있다.

### 활용 시나리오 1: 빌드 및 린트

```
📱 Telegram에서 보내는 메시지:
"npm run build:web 실행하고 에러가 있으면 알려줘"

🖥️ Claude Code가 수행하는 작업:
  → npm run build:web 실행
  → 빌드 로그 분석
  → 결과를 Telegram으로 회신
```

### 활용 시나리오 2: 파서 패턴 추가

```
📱 Telegram:
"apps/web/src/lib/parser.ts에 '대한메디칼' 공급업체 패턴을 추가해줘.
메시지 형식은 '[대한메디칼] 품목: {품목명} 수량: {수량} 배송예정: {날짜}' 야"

🖥️ Claude Code:
  → parser.ts 읽기
  → 새 regex 패턴 추가
  → npm run lint:web로 검증
  → 변경사항 요약을 Telegram으로 회신
```

### 활용 시나리오 3: 데이터베이스 마이그레이션 확인

```
📱 Telegram:
"최근 supabase migration 파일 내용을 요약해줘"

🖥️ Claude Code:
  → packages/supabase/migrations/ 디렉토리 스캔
  → 최신 마이그레이션 파일 분석
  → 변경 테이블, 컬럼, RLS 정책 요약을 Telegram으로 회신
```

### 활용 시나리오 4: Git 작업

```
📱 Telegram:
"현재 브랜치 상태 확인하고, 변경사항 있으면 커밋 메시지 제안해줘"

🖥️ Claude Code:
  → git status, git diff 실행
  → 변경 파일 분석
  → 커밋 메시지 초안을 Telegram으로 회신
```

### 활용 시나리오 5: 코드 리뷰

```
📱 Telegram:
"최근 PR 변경사항 분석하고 리뷰 코멘트 만들어줘"

🖥️ Claude Code:
  → gh pr list, gh pr diff 실행
  → 코드 변경 분석 (보안, 성능, 코드 스타일)
  → 리뷰 요약을 Telegram으로 회신
```

### 사진 전송 활용

Telegram으로 스크린샷이나 이미지를 보낼 수도 있다:

```
📱 Telegram:
[에러 화면 스크린샷 전송]
"이 에러 원인 분석해줘"

🖥️ Claude Code:
  → 이미지가 ~/.claude/channels/telegram/inbox/에 저장됨
  → Claude가 이미지를 읽고 에러 메시지 분석
  → 원인과 해결 방안을 Telegram으로 회신
```

> **참고**: Telegram은 사진을 압축함. 고해상도가 필요하면 Telegram에서 "파일로 전송" 옵션 사용

### 파일 전송 활용

Claude Code가 결과 파일을 Telegram으로 보낼 수도 있다:

```
📱 Telegram:
"일간 주문 통계를 CSV로 만들어서 보내줘"

🖥️ Claude Code:
  → Supabase에서 데이터 쿼리
  → CSV 파일 생성
  → reply 도구로 파일 첨부하여 Telegram으로 전송 (최대 50MB)
```

---

## 6. 고급: 커스텀 Webhook 채널 구축

Telegram 외에, NotiFlow 시스템 이벤트를 직접 Claude Code로 보내는 커스텀 채널을 구축할 수 있다.

### 활용 예: CI 실패 → Claude Code 자동 분석

NotiFlow의 GitHub Actions가 실패하면 Webhook으로 Claude Code에 알려서 자동 분석을 요청하는 채널.

### Step 1: 프로젝트 생성

```bash
mkdir notiflow-webhook-channel && cd notiflow-webhook-channel
bun add @modelcontextprotocol/sdk
```

### Step 2: 채널 서버 작성

```typescript
// webhook.ts
#!/usr/bin/env bun
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const mcp = new Server(
  { name: 'notiflow-webhook', version: '0.1.0' },
  {
    capabilities: { experimental: { 'claude/channel': {} } },
    instructions: `
      이 채널은 NotiFlow 프로젝트의 운영 이벤트를 전달합니다.
      이벤트는 <channel source="notiflow-webhook" type="..." ...> 형식으로 도착합니다.
      type 속성에 따라 적절히 대응하세요:
      - "ci_failure": CI 빌드 실패. 로그를 분석하고 원인을 파악하세요.
      - "parse_failure": 메시지 파싱 실패. parser.ts의 패턴 개선을 제안하세요.
      - "mfds_sync_error": MFDS 동기화 오류. mfds-sync.ts를 점검하세요.
      - "cron_error": Cron Job 실패. 해당 cron 핸들러를 분석하세요.
      이 채널은 단방향입니다. 읽고 분석한 후 터미널에서 작업하세요.
    `,
  },
)

await mcp.connect(new StdioServerTransport())

// Webhook 수신 HTTP 서버
Bun.serve({
  port: 8788,
  hostname: '127.0.0.1',  // localhost만 접근 가능
  async fetch(req) {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    const body = await req.json()
    const eventType = body.type || 'unknown'

    await mcp.notification({
      method: 'notifications/claude/channel',
      params: {
        content: JSON.stringify(body.payload || body, null, 2),
        meta: {
          type: eventType,
          timestamp: new Date().toISOString(),
          source_app: body.source || 'notiflow',
        },
      },
    })

    return new Response(JSON.stringify({ status: 'received' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  },
})
```

### Step 3: MCP 설정 등록

NotiFlow 프로젝트 루트의 `.mcp.json`에 추가:

```json
{
  "mcpServers": {
    "notiflow-webhook": {
      "command": "bun",
      "args": ["./notiflow-webhook-channel/webhook.ts"]
    }
  }
}
```

### Step 4: 테스트

```bash
# Claude Code를 개발 채널 모드로 시작
claude --dangerously-load-development-channels server:notiflow-webhook

# 별도 터미널에서 테스트 이벤트 전송
curl -X POST localhost:8788 \
  -H "Content-Type: application/json" \
  -d '{
    "type": "parse_failure",
    "source": "notiflow-web",
    "payload": {
      "message": "[알수없는형식] 투석액 10박스",
      "confidence": 0.3,
      "raw_message_id": "msg_12345"
    }
  }'
```

Claude Code 세션에서 다음과 같이 수신됨:

```xml
<channel source="notiflow-webhook" type="parse_failure" timestamp="2026-03-20T09:30:00Z" source_app="notiflow-web">
{
  "message": "[알수없는형식] 투석액 10박스",
  "confidence": 0.3,
  "raw_message_id": "msg_12345"
}
</channel>
```

→ Claude가 자동으로 `parser.ts`를 분석하고 새 패턴을 제안

### Step 5: GitHub Actions와 연동 (선택)

`.github/workflows/ci.yml`에 실패 시 Webhook 전송 단계를 추가하면, CI 실패가 자동으로 Claude Code로 전달된다. 단, Webhook 서버가 외부에서 접근 가능해야 하므로 Cloudflare Tunnel이나 ngrok 같은 터널링 도구가 필요하다.

---

## 7. 트러블슈팅

### 자주 발생하는 문제

| 증상 | 원인 | 해결 |
|------|------|------|
| 봇이 메시지에 응답하지 않음 | `--channels` 플래그 없이 Claude Code 실행 | `claude --channels plugin:telegram@claude-plugins-official`으로 재시작 |
| "blocked by org policy" 오류 | Team/Enterprise 조직에서 Channels 미활성화 | 관리자에게 claude.ai Admin → Claude Code → Channels 활성화 요청 |
| 토큰 오류 | BotFather 토큰 복사 불완전 | 숫자:문자열 전체를 다시 복사 |
| 페어링 코드 미수신 | 봇 프로세스가 실행 중이지 않음 | Claude Code가 `--channels`로 실행 중인지 확인 |
| 파일 전송 실패 | 50MB 초과 | 파일을 분할하거나 압축 |
| 이모지 반응 오류 | Telegram 미지원 이모지 사용 | 허용된 이모지만 사용 (👍 👎 ❤ 🔥 👀 💯 🎉 등) |
| 이전 메시지 조회 불가 | Telegram Bot API 제한 | 봇은 실시간 수신 메시지만 처리 가능. 이전 컨텍스트는 수동 전달 |

### 세션 유지 팁

Channels는 Claude Code 세션이 열려 있어야 동작한다. 장시간 사용을 위한 방법:

```bash
# 방법 1: tmux/screen으로 백그라운드 유지
tmux new -s notiflow
claude --channels plugin:telegram@claude-plugins-official
# Ctrl+B, D로 세션 분리 (Claude Code는 계속 실행됨)
# tmux attach -t notiflow로 복귀

# 방법 2: nohup 사용
nohup claude --channels plugin:telegram@claude-plugins-official &
```

### 권한 프롬프트 주의

Claude Code가 파일 수정이나 명령 실행 시 권한 승인을 요청할 수 있다. 부재 중이면 세션이 일시 정지되므로:

- **신뢰 환경에서만**: `--dangerously-skip-permissions` 플래그로 자동 승인 가능
- **권장**: 신뢰할 수 있는 개발 서버에서만 사용하고, 프로덕션 환경에서는 사용하지 않을 것

---

## 요약: 최소 설정 체크리스트

```
□ Bun 설치 완료
□ Claude Code v2.1.80+ 확인
□ claude.ai 로그인 상태
□ BotFather에서 Telegram 봇 생성 → 토큰 복사
□ /plugin install telegram@claude-plugins-official
□ /telegram:configure <토큰>
□ claude --channels plugin:telegram@claude-plugins-official 으로 재시작
□ Telegram에서 봇에게 메시지 전송 → 페어링 코드 수신
□ /telegram:access pair <코드>
□ /telegram:access policy allowlist
□ Telegram에서 테스트 메시지 전송하여 동작 확인 ✅
```

---

## 참고 자료

- [Claude Code Channels 공식 문서](https://code.claude.com/docs/en/channels)
- [Channels Reference (커스텀 채널 구현)](https://code.claude.com/docs/en/channels-reference)
- [Telegram 플러그인 소스코드](https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/telegram)
- [Telegram BotFather](https://t.me/BotFather)
- [Bun 공식 사이트](https://bun.sh)
