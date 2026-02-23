# Offline/Cloud Mode Selection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to choose between Offline (local-only) and Cloud (Supabase sync) modes during onboarding, with runtime switching via Settings.

**Architecture:** Single `AppMode` enum in `AppPreferences` gates all sync/auth behavior. Onboarding gets a 4th page for mode selection. Navigation skips Login for offline users. Settings shows mode-appropriate UI sections.

**Tech Stack:** Kotlin, Jetpack Compose, Hilt DI, Supabase Kotlin SDK, SharedPreferences

---

### Task 1: Add AppMode enum and AppPreferences fields

**Files:**
- Create: `app/src/main/java/com/hart/notimgmt/data/model/AppMode.kt`
- Modify: `app/src/main/java/com/hart/notimgmt/data/preferences/AppPreferences.kt`

**Step 1: Create AppMode enum**

Create `app/src/main/java/com/hart/notimgmt/data/model/AppMode.kt`:

```kotlin
package com.hart.notimgmt.data.model

enum class AppMode {
    OFFLINE,
    CLOUD
}
```

**Step 2: Add appMode and isModeSelected to AppPreferences**

In `AppPreferences.kt`, add after the `isTutorialSeen` property (around line 145):

```kotlin
// App mode (OFFLINE or CLOUD)
var appMode: AppMode
    get() {
        val value = prefs.getString("app_mode", AppMode.CLOUD.name)
        return try {
            AppMode.valueOf(value ?: AppMode.CLOUD.name)
        } catch (e: Exception) {
            AppMode.CLOUD
        }
    }
    set(value) {
        prefs.edit().putString("app_mode", value.name).apply()
    }

val isCloudMode: Boolean
    get() = appMode == AppMode.CLOUD

// Whether user has selected a mode (existing users default to true)
var isModeSelected: Boolean
    get() = prefs.getBoolean("mode_selected", true)
    set(value) {
        prefs.edit().putBoolean("mode_selected", value).apply()
    }
```

Add the import at the top of AppPreferences.kt:
```kotlin
import com.hart.notimgmt.data.model.AppMode
```

**Step 3: Commit**

```
feat(mobile): add AppMode enum and preferences fields
```

---

### Task 2: Add Mode Selection page to OnboardingScreen

**Files:**
- Modify: `app/src/main/java/com/hart/notimgmt/ui/onboarding/OnboardingScreen.kt`

**Step 1: Update page count from 3 to 4**

Change `rememberPagerState(pageCount = { 3 })` to `rememberPagerState(pageCount = { 4 })`.

**Step 2: Update pager to include new page**

In the `HorizontalPager`, change `userScrollEnabled` and add page 3:

```kotlin
HorizontalPager(
    state = pagerState,
    modifier = Modifier.weight(1f),
    userScrollEnabled = pagerState.currentPage != 2 // Disable swipe only on permission page
) { page ->
    when (page) {
        0 -> WelcomePage()
        1 -> FeaturesPage()
        2 -> PermissionPage()
        3 -> ModeSelectionPage(onSelectMode = onModeSelected)
    }
}
```

**Step 3: Update OnboardingScreen signature**

Add `onModeSelected` callback:

```kotlin
@Composable
fun OnboardingScreen(
    onModeSelected: (AppMode) -> Unit,
    onComplete: () -> Unit
)
```

Note: `onComplete` is called after permission page grants (page 2 → page 3), while `onModeSelected` is called from the mode selection page.

**Step 4: Update Skip button logic**

Change `pagerState.currentPage < 2` to `pagerState.currentPage < 2` (skip goes to permission page). On permission page, no skip. On mode selection page, no skip.

```kotlin
if (pagerState.currentPage < 2) {
    TextButton(onClick = {
        coroutineScope.launch { pagerState.animateScrollToPage(2) }
    }) {
        Text("Skip", color = TextMuted)
    }
} else {
    Spacer(modifier = Modifier.height(48.dp))
}
```

**Step 5: Update page indicators from 3 to 4**

Change `repeat(3)` to `repeat(4)` and `if (index < 2)` to `if (index < 3)`.

**Step 6: Update bottom button logic**

```kotlin
val canProceed = when (pagerState.currentPage) {
    2 -> allRequiredPermissionsGranted
    3 -> true // Mode selection page always allows proceed (selection triggers action)
    else -> true
}

Button(
    onClick = {
        when {
            pagerState.currentPage < 2 -> {
                coroutineScope.launch {
                    pagerState.animateScrollToPage(pagerState.currentPage + 1)
                }
            }
            pagerState.currentPage == 2 && canProceed -> {
                // Permission page done → go to mode selection
                coroutineScope.launch {
                    pagerState.animateScrollToPage(3)
                }
            }
            // Page 3 button is handled by ModeSelectionPage cards directly
        }
    },
    // ... existing styling ...
) {
    Text(
        text = when {
            pagerState.currentPage == 2 && !canProceed -> "Grant Permissions"
            pagerState.currentPage < 3 -> "Next"
            else -> "" // Mode page has its own buttons
        },
        // ...
    )
}
```

Actually, hide the bottom button on page 3 since the mode cards act as the CTAs:

```kotlin
if (pagerState.currentPage < 3) {
    // Show indicators and button
    Column(...) {
        // indicators
        // button
    }
}
```

**Step 7: Create ModeSelectionPage composable**

Add to OnboardingScreen.kt:

```kotlin
@Composable
private fun ModeSelectionPage(onSelectMode: (AppMode) -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "Choose Your Mode",
            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
            color = TextDark,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            text = "You can change this later in Settings.",
            style = MaterialTheme.typography.bodyMedium,
            color = TextMuted,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(40.dp))

        // Cloud mode card
        ModeCard(
            icon = Icons.Default.Cloud,
            title = "Cloud Mode",
            description = "Sign in to sync data across devices.\nAutomatic backup & restore.",
            accentColor = BrandBlue,
            onClick = { onSelectMode(AppMode.CLOUD) }
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Offline mode card
        ModeCard(
            icon = Icons.Default.PhoneAndroid,
            title = "Offline Mode",
            description = "No account needed.\nAll data stays on this device.",
            accentColor = BrandPurple,
            onClick = { onSelectMode(AppMode.OFFLINE) }
        )
    }
}

@Composable
private fun ModeCard(
    icon: ImageVector,
    title: String,
    description: String,
    accentColor: Color,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(16.dp),
        color = accentColor.copy(alpha = 0.05f),
        border = BorderStroke(1.dp, accentColor.copy(alpha = 0.3f)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(20.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .background(accentColor.copy(alpha = 0.1f), shape = CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = accentColor,
                    modifier = Modifier.size(24.dp)
                )
            }
            Spacer(modifier = Modifier.width(16.dp))
            Column {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = TextDark
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodySmall,
                    color = TextMuted
                )
            }
        }
    }
}
```

Add these imports to OnboardingScreen.kt:
```kotlin
import com.hart.notimgmt.data.model.AppMode
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.PhoneAndroid
```

**Step 8: Commit**

```
feat(mobile): add mode selection page to onboarding
```

---

### Task 3: Update AppNavigation routing for offline mode

**Files:**
- Modify: `app/src/main/java/com/hart/notimgmt/ui/navigation/AppNavigation.kt`

**Step 1: Update splash destination logic**

In `AppNavigation.kt`, change the splash `onFinished` lambda (lines 74-79):

```kotlin
val destination = when {
    !appPreferences.isOnboardingCompleted -> Routes.ONBOARDING
    !appPreferences.isTutorialSeen -> Routes.TUTORIAL
    appPreferences.isCloudMode && !authManager.isLoggedIn -> Routes.LOGIN
    else -> Routes.MAIN  // Offline mode skips login
}
```

**Step 2: Update Onboarding composable to pass mode selection**

```kotlin
composable(Routes.ONBOARDING) {
    OnboardingScreen(
        onModeSelected = { mode ->
            appPreferences.appMode = mode
            appPreferences.isModeSelected = true
            appPreferences.isOnboardingCompleted = true
            val next = Routes.TUTORIAL
            navController.navigate(next) {
                popUpTo(Routes.ONBOARDING) { inclusive = true }
            }
        },
        onComplete = {
            // No longer used (mode page handles completion)
        }
    )
}
```

**Step 3: Update Tutorial completion to branch by mode**

```kotlin
composable(Routes.TUTORIAL) {
    TutorialScreen(
        fromSettings = false,
        onComplete = {
            appPreferences.isTutorialSeen = true
            val next = if (appPreferences.isCloudMode) Routes.LOGIN else Routes.MAIN
            navController.navigate(next) {
                popUpTo(Routes.TUTORIAL) { inclusive = true }
            }
        }
    )
}
```

**Step 4: Update MainScreen onLogout to handle mode**

In the `MAIN` composable, the `onLogout` now needs to handle both modes. For cloud mode it goes to LOGIN; for offline (which shouldn't normally trigger logout), still go to LOGIN:

```kotlin
composable(Routes.MAIN) {
    MainScreen(
        onLogout = {
            navController.navigate(Routes.LOGIN) {
                popUpTo(Routes.MAIN) { inclusive = true }
            }
        },
        onSwitchToCloud = {
            navController.navigate(Routes.LOGIN) {
                popUpTo(Routes.MAIN) { inclusive = true }
            }
        }
    )
}
```

Update `MainScreen` signature:
```kotlin
@Composable
fun MainScreen(onLogout: () -> Unit = {}, onSwitchToCloud: () -> Unit = {})
```

Pass `onSwitchToCloud` through to `SettingsScreen` → `GeneralScreen`.

**Step 5: Commit**

```
feat(mobile): update navigation to skip login for offline mode
```

---

### Task 4: Guard AuthManager sync with cloud mode check

**Files:**
- Modify: `app/src/main/java/com/hart/notimgmt/data/auth/AuthManager.kt`

**Step 1: Inject AppPreferences into AuthManager**

```kotlin
@Singleton
class AuthManager @Inject constructor(
    private val auth: Auth,
    private val syncManager: SyncManager,
    private val appPreferences: AppPreferences
)
```

Add import:
```kotlin
import com.hart.notimgmt.data.preferences.AppPreferences
```

**Step 2: Guard init block sync start**

```kotlin
init {
    scope.launch {
        auth.sessionStatus.collect { status ->
            when (status) {
                is SessionStatus.Authenticated -> {
                    if (!syncStarted && appPreferences.isCloudMode) {
                        Log.d(TAG, "Session restored — starting sync")
                        syncStarted = true
                        syncManager.startListening()
                        syncManager.schedulePeriodicSync()
                    }
                }
                is SessionStatus.NotAuthenticated -> {
                    if (syncStarted) {
                        Log.d(TAG, "Session lost — stopping sync")
                        syncStarted = false
                        syncManager.stopListening()
                    }
                }
                else -> {}
            }
        }
    }
}
```

**Step 3: Commit**

```
feat(mobile): guard AuthManager sync with cloud mode check
```

---

### Task 5: Guard SyncManager public methods for offline mode

**Files:**
- Modify: `app/src/main/java/com/hart/notimgmt/data/sync/SyncManager.kt`

**Step 1: Inject AppPreferences**

```kotlin
@Singleton
class SyncManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val supabaseDataSource: SupabaseDataSource,
    // ... existing params ...
    private val appPreferences: AppPreferences
)
```

**Step 2: Add isCloudMode helper**

```kotlin
private val isCloudMode: Boolean
    get() = appPreferences.isCloudMode
```

**Step 3: Add early return to public sync methods**

Add `if (!isCloudMode) return` at the start of:
- `forceSync()` (line 247)
- `forceUpload()` (line 275)
- `forceDownload()` (line 309)
- `startListening()` (line 339)
- `syncMessage()` (line 971)
- `syncCategory()` (line 1031)
- `syncFilterRule()` (line 1042)
- `syncStatusStep()` (line 1053)
- `syncAppFilter()` (line 1064)
- `syncPlan()` (line 1075)
- `syncDayCategory()` (line 1086)
- `deleteDayCategory()` (line 1097)
- `schedulePeriodicSync()` (line 1156)

For void methods, just `return`. For suspend methods returning Boolean, `return false` if applicable.

Example for `forceSync()`:
```kotlin
fun forceSync() {
    if (!isCloudMode) {
        addLog("⚠️ 오프라인 모드에서는 동기화를 사용할 수 없습니다")
        return
    }
    // ... rest of existing code
}
```

For `syncMessage()`:
```kotlin
suspend fun syncMessage(message: CapturedMessageEntity) {
    if (!isCloudMode) return
    // ... rest of existing code
}
```

**Step 4: Commit**

```
feat(mobile): guard SyncManager methods for offline mode
```

---

### Task 6: Update Settings/GeneralScreen for mode-aware UI

**Files:**
- Modify: `app/src/main/java/com/hart/notimgmt/viewmodel/SettingsViewModel.kt`
- Modify: `app/src/main/java/com/hart/notimgmt/ui/settings/GeneralScreen.kt`

**Step 1: Add mode state to SettingsViewModel**

```kotlin
@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val authManager: AuthManager,
    private val syncManager: SyncManager,
    private val appPreferences: AppPreferences
) : ViewModel() {

    // Existing fields...

    private val _appMode = MutableStateFlow(appPreferences.appMode)
    val appMode: StateFlow<AppMode> = _appMode.asStateFlow()

    val isCloudMode: Boolean
        get() = appPreferences.isCloudMode

    fun switchToOffline(onComplete: () -> Unit) {
        viewModelScope.launch {
            _isLoggingOut.value = true
            try {
                authManager.signOut()
                appPreferences.appMode = AppMode.OFFLINE
                _appMode.value = AppMode.OFFLINE
                onComplete()
            } finally {
                _isLoggingOut.value = false
            }
        }
    }

    fun prepareCloudSwitch() {
        appPreferences.appMode = AppMode.CLOUD
        _appMode.value = AppMode.CLOUD
    }
}
```

Add import:
```kotlin
import com.hart.notimgmt.data.model.AppMode
```

**Step 2: Update GeneralScreen to show mode-specific UI**

In `GeneralScreen.kt`, add state observation:

```kotlin
val appMode by settingsViewModel.appMode.collectAsState()
val isCloudMode = appMode == AppMode.CLOUD
```

Wrap the cloud sync section (`SettingsSection(title = "클라우드 동기화")`) with:

```kotlin
if (isCloudMode) {
    // Existing cloud sync section (lines 553-876)
    SettingsSection(title = "클라우드 동기화") {
        // ... all existing sync UI ...
    }
} else {
    // Offline mode: show "Switch to Cloud" card
    SettingsSection(title = "데이터 모드") {
        Surface(
            onClick = { /* trigger switch to cloud */ },
            shape = RoundedCornerShape(12.dp),
            color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.3f)),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Outlined.Cloud,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "현재: 오프라인 모드",
                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold)
                    )
                    Text(
                        text = "클라우드로 전환하면 데이터를 동기화할 수 있습니다",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                OutlinedButton(onClick = onSwitchToCloud) {
                    Text("전환", style = MaterialTheme.typography.labelMedium)
                }
            }
        }
    }
}
```

Also update `GeneralScreen` signature to accept `onSwitchToCloud`:

```kotlin
@Composable
fun GeneralScreen(
    viewModel: AppFilterViewModel = hiltViewModel(),
    settingsViewModel: SettingsViewModel = hiltViewModel(),
    onLogout: () -> Unit = {},
    onNavigateToTutorial: () -> Unit = {},
    onSwitchToCloud: () -> Unit = {}
)
```

Add a "Switch to Offline" option in the cloud sync section (after logout button, before the closing brace):

```kotlin
if (isLoggedIn) {
    Spacer(modifier = Modifier.height(8.dp))
    TextButton(
        onClick = {
            // Show confirmation dialog
            showSwitchToOfflineDialog = true
        },
        modifier = Modifier.fillMaxWidth()
    ) {
        Icon(
            imageVector = Icons.Outlined.CloudOff,
            contentDescription = null,
            modifier = Modifier.size(16.dp)
        )
        Spacer(modifier = Modifier.width(6.dp))
        Text("오프라인 모드로 전환", style = MaterialTheme.typography.labelMedium)
    }
}
```

Add the confirmation dialog state and dialog:

```kotlin
var showSwitchToOfflineDialog by remember { mutableStateOf(false) }

// In the composable body:
if (showSwitchToOfflineDialog) {
    ConfirmDialog(
        title = "오프라인 모드로 전환",
        message = "클라우드 동기화가 중단되고 로그아웃됩니다.\n로컬 데이터는 유지됩니다.\n\n계속하시겠습니까?",
        confirmText = "전환",
        onConfirm = {
            showSwitchToOfflineDialog = false
            settingsViewModel.switchToOffline(onLogout)
        },
        onDismiss = { showSwitchToOfflineDialog = false }
    )
}
```

**Step 3: Thread onSwitchToCloud through SettingsScreen**

In `SettingsScreen.kt`, update:

```kotlin
@Composable
fun SettingsScreen(
    onLogout: () -> Unit = {},
    onNavigateToTutorial: () -> Unit = {},
    onSwitchToCloud: () -> Unit = {}
) {
    // ...
    3 -> GeneralScreen(
        onLogout = onLogout,
        onNavigateToTutorial = onNavigateToTutorial,
        onSwitchToCloud = onSwitchToCloud
    )
}
```

**Step 4: Thread onSwitchToCloud through MainScreen and MainNavHost**

In `AppNavigation.kt`:

```kotlin
@Composable
fun MainScreen(onLogout: () -> Unit = {}, onSwitchToCloud: () -> Unit = {}) {
    // ...
    MainNavHost(
        navController = navController,
        modifier = ...,
        onLogout = onLogout,
        onSwitchToCloud = onSwitchToCloud
    )
}

@Composable
private fun MainNavHost(
    navController: NavHostController,
    modifier: Modifier = Modifier,
    onLogout: () -> Unit = {},
    onSwitchToCloud: () -> Unit = {}
) {
    // ...
    composable(Screen.Settings.route, ...) {
        SettingsScreen(
            onLogout = onLogout,
            onNavigateToTutorial = { ... },
            onSwitchToCloud = onSwitchToCloud
        )
    }
}
```

**Step 5: Handle cloud switch in AppNavigation**

In the MAIN composable, the `onSwitchToCloud` callback should:

```kotlin
composable(Routes.MAIN) {
    MainScreen(
        onLogout = {
            navController.navigate(Routes.LOGIN) {
                popUpTo(Routes.MAIN) { inclusive = true }
            }
        },
        onSwitchToCloud = {
            // Set mode to CLOUD, then navigate to login
            // (SettingsViewModel.prepareCloudSwitch already called from GeneralScreen)
            navController.navigate(Routes.LOGIN) {
                popUpTo(Routes.MAIN) { inclusive = true }
            }
        }
    )
}
```

In GeneralScreen, the `onSwitchToCloud` button handler should call `settingsViewModel.prepareCloudSwitch()` before the callback:

```kotlin
OutlinedButton(onClick = {
    settingsViewModel.prepareCloudSwitch()
    onSwitchToCloud()
}) {
    Text("전환", style = MaterialTheme.typography.labelMedium)
}
```

**Step 6: Commit**

```
feat(mobile): add mode-aware settings UI with mode switching
```

---

### Task 7: Handle backward compatibility for existing users

**Files:**
- Modify: `app/src/main/java/com/hart/notimgmt/data/preferences/AppPreferences.kt`

**Step 1: Verify defaults**

Existing users already have:
- `isOnboardingCompleted = true` (they completed it)
- `isTutorialSeen = true` (they completed it)
- `appMode` defaults to `CLOUD` (via getString returning null → CLOUD)
- `isModeSelected` defaults to `true` (via getBoolean returning true)

So existing users will continue with CLOUD mode without seeing mode selection again. No migration needed.

**Step 2: Verify Splash route logic**

For existing logged-in users:
- `isOnboardingCompleted = true` → skip onboarding
- `isTutorialSeen = true` → skip tutorial
- `isCloudMode = true` AND `isLoggedIn = true` → go to MAIN

For existing logged-out users:
- `isCloudMode = true` AND `isLoggedIn = false` → go to LOGIN

Both work correctly.

**Step 3: Commit (if any changes needed)**

```
chore(mobile): verify backward compatibility for mode selection
```

---

### Task 8: Verify and test the complete flow

**Verification checklist:**

1. **Fresh install → Onboarding → Mode Selection (Cloud)**
   - Onboarding 4 pages show correctly
   - Selecting Cloud → Tutorial → Login → Main with sync active

2. **Fresh install → Onboarding → Mode Selection (Offline)**
   - Selecting Offline → Tutorial → Main (no login screen)
   - No Supabase sync attempts in logcat
   - All features (dashboard, messages, kanban, AI chat) work

3. **Offline → Cloud switch via Settings**
   - "전환" button → Login screen appears
   - After login → sync starts, data uploads

4. **Cloud → Offline switch via Settings**
   - "오프라인 모드로 전환" → confirmation dialog
   - Confirm → logout + mode switch, sync stops
   - Local data preserved

5. **Existing user upgrade (no re-onboarding)**
   - Update app → still logged in, CLOUD mode, no mode selection shown

**Commit:**

```
feat(mobile): complete offline/cloud mode selection feature
```
