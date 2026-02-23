# Offline-First with Optional Cloud Sync

**Date:** 2026-02-23
**Status:** Approved

## Problem

The app currently defaults to Cloud mode (`AppMode.CLOUD`), which forces users to the login screen before they can use the app. Users should be able to use the app immediately without any account.

## Solution

Switch to an **offline-first** model:
- App defaults to `OFFLINE` mode — no login required
- Login is accessed only through Settings > "클라우드 모드로 전환" button
- Onboarding mode selection page (Cloud/Offline) is removed

## Navigation Flow

```
BEFORE: Splash → Onboarding(4pg) → Tutorial → [LOGIN if cloud] → Main
AFTER:  Splash → Onboarding(3pg) → Tutorial → Main
                                                  └─ Settings > Cloud연동 → Login → Main
```

## Changes

### 1. AppPreferences.kt
- Default `appMode` from `CLOUD` to `OFFLINE`

### 2. AppNavigation.kt
- Splash routing: Remove `isCloudMode && !isLoggedIn → LOGIN` branch
- Tutorial completion: Always navigate to MAIN
- `onLogout`: Stay on MAIN (switch to offline mode automatically)
- `onSwitchToCloud`: Navigate to LOGIN, on success return to MAIN in cloud mode

### 3. OnboardingScreen.kt
- Remove mode selection page (page 4)
- Reduce to 3 pages: Welcome, Features, Permissions
- Change callback from `onModeSelected(AppMode)` to `onComplete()`
- Set OFFLINE mode automatically on completion

### 4. GeneralScreen.kt / SettingsViewModel.kt
- Logout should switch to offline mode and stay on settings screen (not navigate to login)

### 5. LoginScreen.kt
- No changes needed (already works as standalone)
