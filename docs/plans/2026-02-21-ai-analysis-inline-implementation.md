# AI Inline Analysis Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an inline AI analysis section to MessageDetailScreen that lets users analyze notification messages using the on-device Gemma model, with streaming results and comment storage.

**Architecture:** Extend `MessageViewModel` with AI analysis state and methods, injecting `AiMessageClassifier` and `AiModelManager` via Hilt. Add a new `AiAnalysisSection` composable to `MessageDetailScreen` between the content card and status section. Reuse prompt presets from `AppPreferences`.

**Tech Stack:** Kotlin, Jetpack Compose, Hilt DI, MediaPipe LLM Inference (Gemma 3n), StateFlow

---

### Task 1: Add AI dependencies to MessageViewModel

**Files:**
- Modify: `apps/mobile/app/src/main/java/com/hart/notimgmt/viewmodel/MessageViewModel.kt`

**Step 1: Add AI state classes and new constructor parameters**

Add imports at the top of the file (after existing imports):

```kotlin
import android.graphics.Bitmap
import com.hart.notimgmt.ai.AiMessageClassifier
import com.hart.notimgmt.ai.AiModelManager
import com.hart.notimgmt.ai.GemmaModelConfig.GemmaModelSize
import com.hart.notimgmt.data.model.CommentItem
import kotlinx.coroutines.Job
```

Add `AiAnalysisState` sealed class before the `MessageViewModel` class declaration:

```kotlin
sealed class AiAnalysisState {
    data object Idle : AiAnalysisState()
    data object ModelNotReady : AiAnalysisState()
    data object Analyzing : AiAnalysisState()
    data class Completed(val result: String) : AiAnalysisState()
    data class Error(val message: String) : AiAnalysisState()
}
```

Update the constructor to inject AI dependencies:

```kotlin
@HiltViewModel
class MessageViewModel @Inject constructor(
    private val messageRepository: MessageRepository,
    private val categoryRepository: CategoryRepository,
    private val statusStepRepository: StatusStepRepository,
    private val appPreferences: AppPreferences,
    private val snoozeManager: SnoozeManager,
    private val classifier: AiMessageClassifier,
    private val modelManager: AiModelManager
) : ViewModel() {
```

**Step 2: Add AI state flows and analysis methods**

Add these fields after the existing state declarations (around line 50):

```kotlin
// AI Analysis
private val _aiAnalysisState = MutableStateFlow<AiAnalysisState>(AiAnalysisState.Idle)
val aiAnalysisState: StateFlow<AiAnalysisState> = _aiAnalysisState

private val _aiStreamingText = MutableStateFlow("")
val aiStreamingText: StateFlow<String> = _aiStreamingText

private var aiAnalysisJob: Job? = null

val isModelDownloaded: Boolean
    get() = modelManager.isModelDownloaded(appPreferences.aiModelSize)

val currentModelSize: GemmaModelSize
    get() = appPreferences.aiModelSize
```

Add the AI analysis methods after the existing `deleteComment` method (after line 289):

```kotlin
// ===== AI Analysis =====

fun analyzeWithAi(content: String, attachedImage: Bitmap? = null) {
    if (_aiAnalysisState.value is AiAnalysisState.Analyzing) return

    if (!isModelDownloaded) {
        _aiAnalysisState.value = AiAnalysisState.ModelNotReady
        return
    }

    _aiAnalysisState.value = AiAnalysisState.Analyzing
    _aiStreamingText.value = ""

    val selectedPreset = getSelectedPreset()
    val prompt = buildAnalysisPrompt(content, selectedPreset?.content)

    aiAnalysisJob = viewModelScope.launch {
        try {
            val result = classifier.generate(
                modelSize = appPreferences.aiModelSize,
                prompt = prompt,
                image = attachedImage,
                onPartialResult = { chunk ->
                    _aiStreamingText.update { it + chunk }
                }
            )
            val finalResult = result?.trim() ?: "분석 결과를 생성하지 못했습니다."
            _aiAnalysisState.value = AiAnalysisState.Completed(finalResult)
        } catch (e: Exception) {
            _aiAnalysisState.value = AiAnalysisState.Error(
                e.message ?: "알 수 없는 오류가 발생했습니다."
            )
        } finally {
            _aiStreamingText.value = ""
        }
    }
}

fun saveAnalysisAsComment(messageId: String) {
    val state = _aiAnalysisState.value
    if (state !is AiAnalysisState.Completed) return

    val preset = getSelectedPreset()
    val prefix = if (preset != null) "[AI] ${preset.name}" else "[AI]"
    val commentContent = "$prefix: ${state.result}"

    addComment(messageId, commentContent)
    clearAnalysis()
}

fun clearAnalysis() {
    aiAnalysisJob?.cancel()
    aiAnalysisJob = null
    _aiAnalysisState.value = AiAnalysisState.Idle
    _aiStreamingText.value = ""
}

fun getPresets(): List<com.hart.notimgmt.viewmodel.PromptPreset> {
    return parsePresets(appPreferences.aiPromptPresets)
}

fun getSelectedPresetId(): String {
    return appPreferences.aiSelectedPresetId
}

fun selectAnalysisPreset(id: String) {
    val newId = if (appPreferences.aiSelectedPresetId == id) "" else id
    appPreferences.aiSelectedPresetId = newId
}

private fun getSelectedPreset(): com.hart.notimgmt.viewmodel.PromptPreset? {
    val selectedId = appPreferences.aiSelectedPresetId
    if (selectedId.isBlank()) return null
    return getPresets().firstOrNull { it.id == selectedId }
}

private fun buildAnalysisPrompt(content: String, presetInstruction: String?): String {
    val sb = StringBuilder()
    sb.append("<start_of_turn>user\n")
    if (!presetInstruction.isNullOrBlank()) {
        sb.append("[지침] $presetInstruction\n\n")
    }
    sb.append("다음 알림 메시지를 분석해줘:\n\n")
    sb.append(content)
    sb.append("\n<end_of_turn>\n")
    sb.append("<start_of_turn>model\n")
    return sb.toString()
}

private fun parsePresets(json: String): List<com.hart.notimgmt.viewmodel.PromptPreset> {
    return try {
        val arr = org.json.JSONArray(json)
        (0 until arr.length()).map { i ->
            val obj = arr.getJSONObject(i)
            com.hart.notimgmt.viewmodel.PromptPreset(
                id = obj.getString("id"),
                name = obj.getString("name"),
                content = obj.getString("content")
            )
        }
    } catch (e: Exception) {
        emptyList()
    }
}
```

Note: The `PromptPreset` data class is already defined in `AiChatViewModel.kt` (line 37-41). Reference it with the full path since it's in the same package.

**Step 3: Build and verify compilation**

Run: `cd /mnt/d/Project/09_NotiFlow && ./gradlew :apps:mobile:app:compileDebugKotlin 2>&1 | tail -20`
Expected: BUILD SUCCESSFUL

**Step 4: Commit**

```bash
git add apps/mobile/app/src/main/java/com/hart/notimgmt/viewmodel/MessageViewModel.kt
git commit -m "feat(mobile): add AI analysis state and methods to MessageViewModel"
```

---

### Task 2: Add AiAnalysisSection composable to MessageDetailScreen

**Files:**
- Modify: `apps/mobile/app/src/main/java/com/hart/notimgmt/ui/message/MessageDetailScreen.kt`

**Step 1: Add new imports**

Add these imports at the top of `MessageDetailScreen.kt`:

```kotlin
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.ButtonDefaults
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import com.hart.notimgmt.viewmodel.AiAnalysisState
import com.hart.notimgmt.viewmodel.PromptPreset
```

**Step 2: Collect AI state in MessageDetailScreen**

Inside the `MessageDetailScreen` composable, after existing state declarations (around line 99), add:

```kotlin
val aiAnalysisState by viewModel.aiAnalysisState.collectAsState()
val aiStreamingText by viewModel.aiStreamingText.collectAsState()
```

**Step 3: Insert AiAnalysisSection call between content card and status section**

Find the line `// Status section` (around line 591) and insert just before it:

```kotlin
                // AI Analysis section
                Spacer(modifier = Modifier.height(8.dp))
                AiAnalysisSection(
                    messageContent = message.content,
                    messageId = message.id,
                    analysisState = aiAnalysisState,
                    streamingText = aiStreamingText,
                    presets = remember { viewModel.getPresets() },
                    selectedPresetId = remember { viewModel.getSelectedPresetId() },
                    isModelDownloaded = viewModel.isModelDownloaded,
                    onAnalyze = { viewModel.analyzeWithAi(message.content) },
                    onSaveAsComment = { viewModel.saveAnalysisAsComment(message.id) },
                    onClear = { viewModel.clearAnalysis() },
                    onSelectPreset = { viewModel.selectAnalysisPreset(it) },
                    onNavigateToAiChat = {
                        // Navigate to AI Chat tab for model download
                        coroutineScope.launch {
                            snackbarHostState.showSnackbar("AI 탭에서 모델을 먼저 다운로드하세요")
                        }
                    }
                )
```

**Step 4: Add the AiAnalysisSection composable**

Add this composable function at the bottom of the file, before the last closing brace:

```kotlin
@Composable
private fun AiAnalysisSection(
    messageContent: String,
    messageId: String,
    analysisState: AiAnalysisState,
    streamingText: String,
    presets: List<PromptPreset>,
    selectedPresetId: String,
    isModelDownloaded: Boolean,
    onAnalyze: () -> Unit,
    onSaveAsComment: () -> Unit,
    onClear: () -> Unit,
    onSelectPreset: (String) -> Unit,
    onNavigateToAiChat: () -> Unit
) {
    val clipboardManager = LocalClipboardManager.current
    var presetExpanded by remember { mutableStateOf(false) }
    var selectedName by remember(selectedPresetId, presets) {
        mutableStateOf(presets.firstOrNull { it.id == selectedPresetId }?.name ?: "프리셋 선택")
    }

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainerLow,
        border = BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Header
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.AutoAwesome,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(20.dp)
                )
                Text(
                    text = "AI 분석",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            // Preset selector + Analyze button
            if (analysisState is AiAnalysisState.Idle || analysisState is AiAnalysisState.ModelNotReady || analysisState is AiAnalysisState.Error) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Preset dropdown
                    Box(modifier = Modifier.weight(1f)) {
                        FilterChip(
                            selected = selectedPresetId.isNotBlank(),
                            onClick = { presetExpanded = true },
                            label = { Text(selectedName, maxLines = 1) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = MaterialTheme.colorScheme.primaryContainer
                            )
                        )
                        DropdownMenu(
                            expanded = presetExpanded,
                            onDismissRequest = { presetExpanded = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text("선택 안함 (자유 분석)") },
                                onClick = {
                                    if (selectedPresetId.isNotBlank()) {
                                        onSelectPreset(selectedPresetId)
                                    }
                                    selectedName = "프리셋 선택"
                                    presetExpanded = false
                                }
                            )
                            presets.forEach { preset ->
                                DropdownMenuItem(
                                    text = { Text(preset.name) },
                                    onClick = {
                                        onSelectPreset(preset.id)
                                        selectedName = preset.name
                                        presetExpanded = false
                                    }
                                )
                            }
                        }
                    }

                    // Analyze button
                    FilledTonalButton(
                        onClick = onAnalyze,
                        colors = ButtonDefaults.filledTonalButtonColors(
                            containerColor = MaterialTheme.colorScheme.primaryContainer,
                            contentColor = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    ) {
                        Icon(
                            imageVector = Icons.Default.AutoAwesome,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("분석")
                    }
                }
            }

            // Model not ready message
            if (analysisState is AiAnalysisState.ModelNotReady) {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.5f)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            text = "AI 모델이 다운로드되지 않았습니다",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onErrorContainer
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        TextButton(onClick = onNavigateToAiChat) {
                            Text("AI 탭에서 다운로드하기")
                        }
                    }
                }
            }

            // Error message
            if (analysisState is AiAnalysisState.Error) {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.5f)
                ) {
                    Text(
                        text = (analysisState as AiAnalysisState.Error).message,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onErrorContainer,
                        modifier = Modifier.padding(12.dp)
                    )
                }
            }

            // Analyzing - streaming text
            if (analysisState is AiAnalysisState.Analyzing) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = "분석 중...",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                if (streamingText.isNotEmpty()) {
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = MaterialTheme.colorScheme.surfaceContainerHighest
                    ) {
                        Text(
                            text = streamingText,
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }
            }

            // Completed - result with action buttons
            if (analysisState is AiAnalysisState.Completed) {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = MaterialTheme.colorScheme.surfaceContainerHighest
                ) {
                    Text(
                        text = (analysisState as AiAnalysisState.Completed).result,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(12.dp)
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Save as comment
                    FilledTonalButton(
                        onClick = onSaveAsComment,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.filledTonalButtonColors(
                            containerColor = MaterialTheme.colorScheme.primaryContainer,
                            contentColor = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    ) {
                        Icon(
                            imageVector = Icons.Default.Save,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("댓글로 저장")
                    }

                    // Copy to clipboard
                    IconButton(onClick = {
                        val text = (analysisState as AiAnalysisState.Completed).result
                        clipboardManager.setText(AnnotatedString(text))
                    }) {
                        Icon(
                            imageVector = Icons.Default.ContentCopy,
                            contentDescription = "복사",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    // Clear
                    IconButton(onClick = onClear) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "지우기",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}
```

**Step 5: Build and verify**

Run: `cd /mnt/d/Project/09_NotiFlow && ./gradlew :apps:mobile:app:compileDebugKotlin 2>&1 | tail -20`
Expected: BUILD SUCCESSFUL

**Step 6: Commit**

```bash
git add apps/mobile/app/src/main/java/com/hart/notimgmt/ui/message/MessageDetailScreen.kt
git commit -m "feat(mobile): add AI analysis section to notification detail screen"
```

---

### Task 3: Verify end-to-end compilation and fix any issues

**Files:**
- Potentially: any file from Tasks 1-2

**Step 1: Full debug build**

Run: `cd /mnt/d/Project/09_NotiFlow && ./gradlew :apps:mobile:app:assembleDebug 2>&1 | tail -30`
Expected: BUILD SUCCESSFUL

If there are import issues with `PromptPreset`, the class is defined at `AiChatViewModel.kt:37-41`. Since it's in the same `viewmodel` package, it should be accessible directly. If not, add the import:

```kotlin
import com.hart.notimgmt.viewmodel.PromptPreset
```

**Step 2: Fix any compilation errors**

Address any errors from Step 1. Common issues:
- Missing imports: add them
- `PromptPreset` visibility: ensure it's `data class` not `private`
- Hilt injection order: `AiMessageClassifier` and `AiModelManager` are `@Singleton` so they should be injectable

**Step 3: Commit any fixes**

```bash
git add -u
git commit -m "fix(mobile): resolve AI analysis compilation issues"
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `MessageViewModel.kt` | Add `AiAnalysisState`, inject `AiMessageClassifier` + `AiModelManager`, add `analyzeWithAi()`, `saveAnalysisAsComment()`, `clearAnalysis()`, preset methods |
| `MessageDetailScreen.kt` | Add `AiAnalysisSection` composable, wire it between content card and status section |

**Total new code:** ~250 lines across 2 files
**No new files created.** No DB migration needed. No new Hilt modules.
