# Claude Code Channels — NotiFlow 연동 가이드

> 작성일: 2026-03-20
> 상태: Research Preview (변경 가능성 있음)

## 1. Claude Code Channels란?

Claude Code Channels는 Anthropic이 2026년 3월에 공개한 Research Preview 기능으로, **외부 메시징 플랫폼(Telegram, Discord 등)에서 실행 중인 Claude Code 세션으로 메시지를 푸시**할 수 있게 해주는 양방향 통신 브릿지이다.

기존의 동기식 "요청-대기" 모델에서 벗어나, 개발자가 터미널을 떠나 있어도 Claude가 이벤트에 반응하여 작업을 수행하는 **비동기 자율 파트너십** 모델을 구현한다.

### 핵심 개념

- **Channel = MCP 서버**: MCP(Model Context Protocol) 기반으로 동작하며, 외부 플랫폼과 Claude Code 세션 사이의 양방향 브릿지 역할
- **이벤트 푸시**: CI 결과, 채팅 메시지, 모니터링 알림 등을 Claude Code 세션으로 전달
- **양방향 통신**: Claude가 이벤트를 읽고 동일 채널을 통해 응답 가능
- **세션 기반**: 세션이 열려 있는 동안만 이벤트 수신 가능 (상시 운영 시 백그라운드 프로세스 활용)

### 요구사항

| 항목 | 조건 |
|------|------|
| Claude Code 버전 | v2.1.80 이상 |
| 인증 | claude.ai 로그인 필수 (Console/API 키 인증 미지원) |
| 런타임 | Bun JavaScript 런타임 필요 |
| 조직 플랜 | Pro/Max: 기본 사용 가능, Team/Enterprise: 관리자 활성화 필요 |

## 2. 지원 플랫폼

현재 Research Preview에서 공식 지원하는 채널:

| 플랫폼 | 플러그인 | 용도 |
|--------|---------|------|
| **Telegram** | `telegram@claude-plugins-official` | 모바일에서 Claude Code 원격 제어 |
| **Discord** | `discord@claude-plugins-official` | 팀 서버에서 Claude Code 공유 접근 |
| **Fakechat** | `fakechat@claude-plugins-official` | localhost 데모/테스트용 |
| **커스텀 채널** | 직접 구현 가능 | Channels Reference 문서 참고 |

## 3. 설정 방법

### 3-1. Telegram 채널 설정

```bash
# 1단계: Telegram에서 BotFather로 봇 생성
# @BotFather에게 /newbot 전송 → 봇 이름, 유저네임 설정 → 토큰 복사

# 2단계: 플러그인 설치 (Claude Code 세션 내에서)
/plugin install telegram@claude-plugins-official

# 3단계: 토큰 구성
/telegram:configure <YOUR_BOT_TOKEN>
# 토큰이 .claude/channels/telegram/.env에 저장됨
# 또는 환경변수 TELEGRAM_BOT_TOKEN으로 설정 가능

# 4단계: 채널 활성화하여 재시작
claude --channels plugin:telegram@claude-plugins-official

# 5단계: 페어링
# Telegram에서 봇에게 아무 메시지 전송 → 페어링 코드 수신
/telegram:access pair <pairing-code>
/telegram:access policy allowlist    # 허용 목록 정책 적용
```

### 3-2. Discord 채널 설정

```bash
# 1단계: Discord Developer Portal에서 봇 생성
# New Application → Bot 섹션에서 토큰 복사
# Privileged Gateway Intents > Message Content Intent 활성화
# OAuth2 > URL Generator에서 bot 스코프 + 권한 설정 후 서버 초대

# 2단계: 플러그인 설치
/plugin install discord@claude-plugins-official

# 3단계: 토큰 구성
/discord:configure <YOUR_BOT_TOKEN>

# 4단계: 채널 활성화하여 재시작
claude --channels plugin:discord@claude-plugins-official

# 5단계: 페어링
# Discord에서 봇에게 DM → 페어링 코드 수신
/discord:access pair <pairing-code>
/discord:access policy allowlist
```

### 3-3. 복수 채널 동시 사용

```bash
claude --channels plugin:telegram@claude-plugins-official plugin:discord@claude-plugins-official
```

## 4. 보안 모델

Channels는 다층 보안 구조를 갖추고 있다:

1. **Sender Allowlist**: 페어링된 사용자 ID만 메시지 푸시 가능, 미등록 발신자는 무시됨
2. **Pairing 프로세스**: 6자리 코드 기반 1:1 매칭으로 신원 확인
3. **세션 단위 제어**: `--channels` 플래그로 세션마다 활성화할 서버를 명시적으로 지정
4. **Enterprise 제어**: Team/Enterprise 플랜에서 `channelsEnabled` 관리 설정으로 조직 수준 제어
5. **MCP 등록 분리**: `.mcp.json`에 등록만으로는 메시지 푸시 불가, 반드시 `--channels`에 명시 필요

## 5. NotiFlow 프로젝트 연동 방안

NotiFlow의 아키텍처와 Claude Code Channels의 특성을 결합하면, 아래와 같은 활용 시나리오가 가능하다.

### 시나리오 A: 개발 워크플로우 자동화 (Telegram)

**목적**: 개발자가 외출 중에도 Telegram으로 NotiFlow 개발 작업을 지시하고 결과를 수신

```
개발자(Telegram) → "주문 파싱 로직에 새 공급업체 패턴 추가해줘"
                         ↓
Claude Code (NotiFlow 프로젝트)
  → apps/web/src/lib/parser.ts 수정
  → npm run lint:web 실행
  → 결과를 Telegram으로 회신
```

**활용 예시**:
- 긴급 버그 수정 요청: "parser.ts에서 '○○제약' 패턴 매칭 안 되는 거 확인하고 수정해줘"
- 빌드 상태 확인: "npm run build:web 돌려보고 결과 알려줘"
- DB 마이그레이션 검토: "최근 migration 파일 변경사항 요약해줘"
- 코드 리뷰: "오늘 PR 내용 분석해서 리뷰 코멘트 초안 만들어줘"

### 시나리오 B: CI/CD 파이프라인 알림 수신 (Discord)

**목적**: GitHub Actions CI 결과를 Discord 채널을 통해 Claude Code로 전달, 자동 대응

```
GitHub Actions CI 실패
  → Discord Webhook → Claude Code 채널
  → Claude가 실패 로그 분석
  → 수정 코드 제안 또는 자동 수정 후 Discord로 보고
```

**NotiFlow CI 연동 포인트**:
- `apps/web/**` 변경 시 웹 빌드/린트 실패 자동 분석
- `apps/mobile/**` 변경 시 Android 빌드/테스트 실패 분석
- Vercel 배포 실패 시 원인 진단

### 시나리오 C: Supabase 이벤트 모니터링 (커스텀 채널)

**목적**: Supabase 데이터베이스 이벤트를 커스텀 채널로 Claude Code에 전달

```
Supabase Realtime (captured_messages 테이블 변경)
  → 커스텀 Channel MCP 서버
  → Claude Code 세션
  → 파싱 실패 메시지 자동 분석 및 패턴 개선 제안
```

**잠재적 활용**:
- AI 파싱 confidence < 0.7인 메시지 자동 수집 → 파서 개선 제안
- 새로운 공급업체/병원 데이터 패턴 감지 시 알림
- MFDS sync 실패 시 원인 분석

### 시나리오 D: 운영 모니터링 및 자동 대응

**목적**: Vercel Cron Job, MFDS 동기화 등 운영 이벤트를 모니터링

```
Vercel Cron Job (일간/월간 리포트 생성)
  → 실패 시 Webhook → Claude Code 채널
  → Claude가 로그 분석 후 수정 방안 회신

MFDS 동기화 (매일 19:00 UTC)
  → 동기화 실패 감지 → Claude Code 채널
  → API 응답 분석 후 재시도 또는 코드 수정
```

## 6. 커스텀 채널 구현 아이디어

NotiFlow에 특화된 커스텀 채널을 직접 구현하면 더 깊은 통합이 가능하다.

### NotiFlow Supabase Monitor Channel

```
구현 개요:
1. Supabase Realtime 구독 → captured_messages INSERT 이벤트 감지
2. MCP 서버로 구현하여 Claude Code 세션에 이벤트 푸시
3. Claude가 자동으로:
   - 새 메시지의 파싱 가능 여부 분석
   - parser.ts의 regex 패턴 커버리지 평가
   - 필요시 새 패턴 추가 PR 생성
```

### NotiFlow Health Check Channel

```
구현 개요:
1. 주기적으로 NotiFlow 서비스 상태 확인
   - Vercel 배포 상태
   - Supabase 연결 상태
   - MFDS API 응답 상태
2. 이상 감지 시 Claude Code로 알림
3. Claude가 자동 진단 및 복구 방안 제시
```

## 7. 실제 도입 로드맵

### Phase 1: 기본 설정 (1~2일)

1. Bun 런타임 설치
2. Claude Code v2.1.80+ 확인
3. Telegram 봇 생성 및 채널 설정
4. 기본적인 개발 명령(빌드, 린트, 테스트) Telegram으로 실행 테스트

### Phase 2: 개발 워크플로우 통합 (1주)

1. Discord 봇 설정 (팀 서버 연동)
2. GitHub Actions → Discord Webhook 연동
3. CI 실패 시 Claude Code 자동 분석 파이프라인 구축
4. 개발팀 onboarding (페어링 프로세스 문서화)

### Phase 3: 커스텀 채널 개발 (2~3주)

1. Channels Reference 문서 기반 커스텀 MCP 서버 설계
2. Supabase Realtime 이벤트 브릿지 구현
3. NotiFlow 운영 모니터링 채널 구현
4. 테스트 (`--dangerously-load-development-channels` 활용)

### Phase 4: 운영 안정화 (지속)

1. 상시 운영용 백그라운드 Claude Code 세션 구성
2. 알림 노이즈 튜닝 (불필요한 이벤트 필터링)
3. 보안 정책 강화 (allowlist 관리, 권한 최소화)
4. Research Preview → GA 전환 시 마이그레이션

## 8. 주의사항 및 제한

- **Research Preview**: API, 플래그 문법, 프로토콜이 변경될 수 있음
- **세션 의존성**: Claude Code 세션이 열려 있어야 이벤트 수신 가능 (상시 운영 시 백그라운드 프로세스 필요)
- **권한 프롬프트**: 부재 중 권한 승인 요청 시 세션 일시 정지 (`--dangerously-skip-permissions`는 신뢰 환경에서만 사용)
- **Allowlist 전용 플러그인**: 현재 Anthropic 공식 플러그인만 `--channels`에 등록 가능
- **인증 제한**: claude.ai 로그인만 지원, API 키 인증 미지원

## 9. 참고 자료

- [Claude Code Channels 공식 문서](https://code.claude.com/docs/en/channels)
- [Channels Reference (커스텀 채널 구현 가이드)](https://code.claude.com/docs/en/channels-reference)
- [Telegram 플러그인 소스코드](https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/telegram)
- [Discord 플러그인 소스코드](https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/discord)
- [VentureBeat: Anthropic ships Claude Code Channels](https://venturebeat.com/orchestration/anthropic-just-shipped-an-openclaw-killer-called-claude-code-channels)
- [Techzine: Claude Code Channels](https://www.techzine.eu/news/devops/139777/anthropic-builds-openclaw-rival-claude-code-channels/)
