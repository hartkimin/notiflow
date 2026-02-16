# NotiFlow

> **Manage Your Notification Flow** &nbsp;|&nbsp; v3.5.0

Android notification & SMS capture/management app with on-device AI. Automatically collects notifications from selected apps, categorizes them with smart filter rules, and lets you chat with an on-device AI assistant.

## Features

### Notification & Message Capture
- **Notification Capture** - Automatically captures notifications from selected apps via NotificationListenerService
- **Deep Link to Source** - Open the exact conversation/chat in the original app (dual-layer PendingIntent cache with sender-based fallback)
- **SMS Capture** - Captures incoming SMS messages with BroadcastReceiver
- **Smart Categorization** - Filter rules with sender/keyword + app-specific conditions auto-classify messages into categories
- **Message Editing** - Edit message content with "edited" indicator and view original text
- **Comment Timeline** - Add multiple timestamped comments to any message
- **Status Change History** - Automatic tracking of status transitions
- **Snooze** - Snooze notifications for later review

### AI Chat (On-Device)
- **Gemma 3N** - On-device LLM powered by MediaPipe LLM Inference (no server required)
- **Multimodal Input** - Image (gallery/camera) and voice (SpeechRecognizer) input support
- **Model Management** - Download/delete models via WorkManager with foreground service notification
- **Streaming Response** - Real-time token-by-token response display

### Weekly Schedule Planner
- **Day-Based Planning** - Per-day category selection, plan add/complete/delete, order number management
- **Day-Specific Categories** - Choose different categories for each day of the week independently
- **Fill All Categories** - One-tap to add all active categories to every day of the week
- **Uncategorized Message Linking** - Link messages without a category to any day's plan
- **Week Picker Calendar** - Month calendar dialog for week-level navigation

### Browsing & Search
- **Calendar View** - Browse captured messages by date with an interactive calendar
- **Dashboard** - At-a-glance stats (today's count, pending, completed) with collapsing header
- **Search** - Swipe-down search bar on message list, schedule, and dashboard

### Settings & Filter
- **App Filter** - Collapsible app selector: selected apps shown by default, expandable to full list with search
- **Filter Rules** - AND/OR condition types with per-app targeting (targetAppPackages)
- **Settings Tabs** - Keyword → Status → App → General (prioritized by usage frequency)
- **Category Toggle** - Enable/disable individual categories

### Data & Sync
- **Cloud Sync** - Two-way sync with Supabase (messages, categories, filter rules, status steps, plans, day categories)
- **Backup / Restore** - JSON export/import for offline backup (format v7)

### UI & UX
- **5-Tab Navigation** - Dashboard | Messages | AI | Schedule | Settings
- **Home Widget** - Today/pending/urgent counts on the home screen
- **Dark Mode** - System, Light, Dark theme options
- **Onboarding** - Guided setup with permission configuration
- **Swipe Actions** - Optimized swipe-to-dismiss with smooth performance

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | Kotlin |
| UI | Jetpack Compose + Material 3 |
| DI | Hilt |
| Database | Room (SQLite) |
| AI | MediaPipe LLM Inference (Gemma 3N) |
| Cloud | Supabase (Auth, PostgREST, Realtime) |
| Network | Ktor (OkHttp) |
| Image | Coil |
| Navigation | Jetpack Navigation Compose |
| Architecture | MVVM (ViewModel + StateFlow + Repository) |

## Architecture

```
Entity  ->  Dao  ->  Repository  ->  ViewModel  ->  Screen
                          |
                     SyncManager  <->  Supabase
                          |
                     BackupManager  ->  JSON
```

- **Entity / Dao / Repository** - Room database layer with reactive Flow queries
- **ViewModel** - State management with StateFlow, business logic
- **Screen** - Jetpack Compose UI with Material 3 theming
- **SyncManager** - Bidirectional Room <-> Supabase sync
- **BackupManager** - JSON export/import with FK-safe ordering

## Design System

TWS-inspired iOS Glassmorphism theme:
- **Primary**: Sky Blue (`#5DADE2`)
- **Secondary**: Mint (`#48D1CC`)
- **Glass surfaces**: Semi-transparent white with blur backdrop
- **Cards**: `Surface` + `16dp` corners + `0.5dp` border at 30% opacity
- **Collapsing NotiFlowHeader**: Gradient background that shrinks on scroll

## Project Structure

```
app/src/main/java/com/hart/notimgmt/
├── data/
│   ├── auth/           # Supabase auth
│   ├── backup/         # JSON backup/restore
│   ├── db/             # Room (entities, DAOs, migrations)
│   ├── model/          # Data classes (CommentItem, StatusChangeItem, etc.)
│   ├── preferences/    # SharedPreferences / EncryptedPrefs
│   ├── repository/     # Repository layer
│   ├── supabase/       # Supabase data source
│   └── sync/           # SyncManager
├── ai/                 # On-device AI (Gemma 3N, MediaPipe, model management)
├── di/                 # Hilt modules
├── service/
│   ├── notification/   # NotificationListenerService, SmsReceiver, FilterEngine, DeepLinkCache
│   └── snooze/         # Snooze scheduler
├── ui/
│   ├── calendar/       # Calendar tab
│   ├── chat/           # AI Chat tab
│   ├── components/     # Shared composables (NotiFlowHeader, TwsBackground, etc.)
│   ├── dashboard/      # Dashboard tab
│   ├── filter/         # Filter settings (app selector, rule editor)
│   ├── insight/        # Insight/analytics screens
│   ├── kanban/         # Weekly schedule planner
│   ├── login/          # Auth screens
│   ├── message/        # Message list, detail, card
│   ├── navigation/     # NavHost, Screen routes
│   ├── onboarding/     # First-launch setup
│   ├── settings/       # Settings tabs (keyword, status, app, general)
│   ├── splash/         # Splash screen
│   ├── status/         # Status step management
│   └── theme/          # Material 3 theme, colors, typography
├── viewmodel/          # ViewModels
└── widget/             # Home screen widget
```

## Requirements

- Android 8.0+ (API 26)
- Android Studio Ladybug+
- JDK 11

## Building

```bash
./gradlew assembleDebug
```

## Permissions

| Permission | Required | Purpose |
|-----------|----------|---------|
| Notification Listener | Yes | Read app notifications |
| Battery Optimization Exempt | Recommended | Stable background operation |
| QUERY_ALL_PACKAGES | Yes | List all installed apps for filter selection |
| RECEIVE_SMS / READ_SMS | Optional | Capture SMS messages |
| POST_NOTIFICATIONS (API 33+) | Optional | Show capture alerts |
| CAMERA | Optional | AI Chat image input (camera) |
| RECORD_AUDIO | Optional | AI Chat voice input |
| FOREGROUND_SERVICE | Yes | AI model download progress |

## Version History

| Version | Highlights |
|---------|-----------|
| v3.5.0 | AI 채팅 (Gemma 3N 멀티모달), 알림 딥링크, 필터 앱 지정, 스케쥴 일괄 채우기 |
| v3.4.0 | 요일별 카테고리 선택, 스케쥴 탭, 앱 필터 접기/펼치기, 스와이프 성능 개선 |
| v3.3.0 | 주간 계획 보드, 메시지 편집, 달력 주 선택기, 앱 선택 개선 |
| v3.1.0 | Hero Header, 검색바, 온보딩 리브랜딩, 앱 선택 고도화 |
| v3.0.0 | NotiFlow 리브랜딩, TWS Glassmorphism 디자인 시스템 |

## License

Private project. All rights reserved.
