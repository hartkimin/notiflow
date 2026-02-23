# Offline/Cloud Mode Selection Design

**Date:** 2026-02-23
**Status:** Approved

## Overview

Add a mode selection feature to the app's initial setup flow, allowing users to choose between:
- **Cloud Mode** — Full Supabase sync, requires login (current behavior)
- **Offline Mode** — Local-only storage, no login required

Users can switch modes later via Settings.

## Architecture: AppPreferences Flag

A single `AppMode` enum stored in `AppPreferences` controls all sync/auth gating. Minimal changes to existing codebase — no DI restructuring needed.

```kotlin
enum class AppMode { OFFLINE, CLOUD }
```

### New AppPreferences Fields
- `appMode: AppMode` — Current operating mode
- `isModeSelected: Boolean` — Whether user has completed mode selection

## Navigation Flow

```
Splash → Onboarding(4 pages) → Tutorial → [Branch by mode]
                                             ├─ CLOUD  → Login → Main(sync ON)
                                             └─ OFFLINE → Main(sync OFF, no login)
```

### Onboarding Changes
- Add 4th page: Mode Selection (after permissions page)
- Two card buttons: "Cloud (Supabase Sync)" / "Offline (Device Only)"
- Cloud card: brief description of sync/backup benefits
- Offline card: brief description of privacy/no-account benefits
- Selection sets `appMode` and `isModeSelected = true`

### AppNavigation Route Decision
```kotlin
val destination = when {
    !appPreferences.isOnboardingCompleted → Routes.ONBOARDING
    !appPreferences.isTutorialSeen → Routes.TUTORIAL
    appPreferences.appMode == AppMode.OFFLINE → Routes.MAIN  // skip login
    !authManager.isLoggedIn → Routes.LOGIN
    else → Routes.MAIN
}
```

## Feature Scope by Mode

| Feature | Cloud | Offline |
|---------|-------|---------|
| Notification capture | Yes | Yes |
| Categories / Filter rules | Yes | Yes |
| Messages / Status steps | Yes | Yes |
| Kanban / Plans | Yes | Yes |
| AI Chat | Yes | Yes |
| Dashboard | Yes | Yes |
| Supabase sync | Yes | **No** |
| Login/Logout | Yes | **No** |
| Backup to cloud | Yes | **No** |
| Local JSON backup | Yes | Yes |

Only Supabase sync is disabled in offline mode. All other features work identically.

## Component Changes

### AppPreferences
- Add `appMode: AppMode` (default: CLOUD for backward compat with existing users)
- Add `isModeSelected: Boolean` (default: true for existing users)

### OnboardingScreen
- Add page 4: mode selection cards
- Page count: 3 → 4
- Permission page (page 2) behavior unchanged
- Mode selection page (page 3): both options enabled, no forced selection

### AppNavigation
- Add `OFFLINE` mode check before login check
- Offline mode: route directly to MAIN, skip LOGIN

### AuthManager
- Guard `startListening()` with `isCloudMode` check
- Guard session observation with mode check
- Add `isCloudMode: Boolean` property reading from AppPreferences

### SyncManager
- Add early return in all public sync methods when offline
- `forceSync()`, `forceUpload()`, `forceDownload()` → no-op in offline
- `syncMessage()`, `syncCategory()`, etc. → no-op in offline
- `startListening()` → no-op in offline

### Settings Screen
- **Cloud mode:** Show account info, sync section, "Switch to Offline" option
- **Offline mode:** Hide account/sync sections, show "Switch to Cloud" card

## Mode Switching

### Offline → Cloud
1. User taps "Switch to Cloud" in Settings
2. Navigate to Login screen
3. On login success: `appMode = CLOUD`
4. SyncManager starts, local data auto-uploads

### Cloud → Offline
1. User taps "Switch to Offline" in Settings
2. Confirmation dialog (warn about sync stopping)
3. On confirm: logout + `appMode = OFFLINE`
4. SyncManager stops, local data preserved

## Backward Compatibility

Existing users (already logged in) should not be affected:
- `appMode` defaults to `CLOUD`
- `isModeSelected` defaults to `true`
- No re-onboarding required
