package com.hart.notimgmt.ui.chat

import android.Manifest
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import androidx.activity.compose.BackHandler
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.automirrored.outlined.Chat
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.CalendarToday
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Key
import androidx.compose.material.icons.outlined.Mic
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.outlined.Photo
import androidx.compose.material.icons.outlined.RadioButtonUnchecked
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Storage
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.hart.notimgmt.ai.GemmaModelSize
import com.hart.notimgmt.ui.filter.SegmentedSelector
import com.hart.notimgmt.ui.theme.NotiRouteDesign
import com.hart.notimgmt.ui.message.formatRelativeTime
import com.hart.notimgmt.viewmodel.AiChatViewModel
import com.hart.notimgmt.viewmodel.AttachedMessage
import com.hart.notimgmt.viewmodel.ChatRole
import com.hart.notimgmt.viewmodel.PromptPreset
import kotlinx.coroutines.Dispatchers
import androidx.compose.runtime.snapshotFlow
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class, FlowPreview::class)
@Composable
fun AiChatScreen(
    viewModel: AiChatViewModel = hiltViewModel()
) {
    val messages by viewModel.messages.collectAsState()
    val isGenerating by viewModel.isGenerating.collectAsState()
    val streamingText by viewModel.streamingText.collectAsState()
    val modelSize by viewModel.modelSize.collectAsState()
    val isModelDownloaded by viewModel.isModelDownloaded.collectAsState()
    val downloadedFileSize by viewModel.downloadedFileSize.collectAsState()
    val downloadProgress by viewModel.downloadProgress.collectAsState()
    val downloadError by viewModel.downloadError.collectAsState()
    val isLoggedIn by viewModel.isLoggedIn.collectAsState()
    val tokenValidating by viewModel.tokenValidating.collectAsState()
    val tokenError by viewModel.tokenError.collectAsState()
    val presets by viewModel.presets.collectAsState()
    val selectedPresetId by viewModel.selectedPresetId.collectAsState()

    val glassColors = NotiRouteDesign.glassColors
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var inputText by rememberSaveable { mutableStateOf("") }
    var showSettings by rememberSaveable { mutableStateOf(false) }
    var checkingAccess by rememberSaveable { mutableStateOf(false) }
    var showAgreementSheet by rememberSaveable { mutableStateOf(false) }
    var showErrorDialog by rememberSaveable { mutableStateOf(false) }
    val listState = rememberLazyListState()
    val sheetState = rememberModalBottomSheetState()

    // ===== Message attachment state =====
    val pickerMessages by viewModel.pickerMessages.collectAsState()
    val pickerCategories by viewModel.pickerCategories.collectAsState()
    var pendingMessages by remember { mutableStateOf<List<AttachedMessage>>(emptyList()) }
    var showMessagePicker by rememberSaveable { mutableStateOf(false) }
    var pickerSelectedIds by remember { mutableStateOf<Set<String>>(emptySet()) }

    // ===== Multimodal state =====
    var pendingImage by remember { mutableStateOf<Bitmap?>(null) }
    var showAttachMenu by rememberSaveable { mutableStateOf(false) }
    var isListening by remember { mutableStateOf(false) }

    // ===== SpeechRecognizer =====
    // Use a stable callback ref so the listener always reads current inputText
    val onSpeechResult = remember { mutableStateOf<(String) -> Unit>({}) }
    onSpeechResult.value = { spoken: String ->
        inputText = if (inputText.isBlank()) spoken else "$inputText $spoken"
    }

    val speechRecognizer = remember(context) { SpeechRecognizer.createSpeechRecognizer(context) }
    DisposableEffect(speechRecognizer) {
        val listener = object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() { isListening = false }
            override fun onError(error: Int) { isListening = false }
            override fun onPartialResults(partialResults: Bundle?) {}
            override fun onEvent(eventType: Int, params: Bundle?) {}
            override fun onResults(results: Bundle?) {
                isListening = false
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                if (!matches.isNullOrEmpty()) {
                    onSpeechResult.value(matches[0])
                }
            }
        }
        speechRecognizer.setRecognitionListener(listener)
        onDispose {
            try { speechRecognizer.stopListening() } catch (_: Exception) {}
            speechRecognizer.destroy()
        }
    }

    fun startListening() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ko-KR")
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }
        isListening = true
        speechRecognizer.startListening(intent)
    }

    // ===== Launchers =====

    // Gallery picker
    val galleryLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        if (uri != null) {
            scope.launch {
                val bitmap = withContext(Dispatchers.IO) { loadBitmapFromUri(context, uri) }
                pendingImage?.recycle()
                pendingImage = bitmap
            }
        }
    }

    // Mic permission
    val micPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            startListening()
        }
    }

    // Auto scroll to bottom on new messages
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            val targetIndex = messages.size - 1
            listState.animateScrollToItem(targetIndex)
        }
    }

    // Debounced scroll during streaming (every 150ms instead of per-token)
    LaunchedEffect(isGenerating) {
        if (isGenerating) {
            snapshotFlow { streamingText }
                .debounce(150)
                .collectLatest {
                    if (it.isNotEmpty()) {
                        val targetIndex = messages.size // streaming item is after messages
                        listState.animateScrollToItem(targetIndex)
                    }
                }
        }
    }

    // Launcher for gated model agreement
    val agreementLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) {
        viewModel.startDownloadWithToken(viewModel.curAccessToken)
    }

    val onDownloadClick: () -> Unit = {
        if (!checkingAccess) {
            scope.launch(Dispatchers.IO) {
                checkingAccess = true
                viewModel.clearDownloadError()

                val firstCode = viewModel.getModelUrlResponse()
                if (firstCode == HttpURLConnection.HTTP_OK) {
                    withContext(Dispatchers.Main) {
                        viewModel.startDownloadWithToken(null)
                    }
                    checkingAccess = false
                    return@launch
                } else if (firstCode < 0) {
                    checkingAccess = false
                    showErrorDialog = true
                    return@launch
                }

                val token = viewModel.curAccessToken
                if (token.isBlank()) {
                    viewModel.setDownloadError("먼저 HuggingFace 토큰을 등록하세요.")
                    checkingAccess = false
                    return@launch
                }

                val tokenCode = viewModel.getModelUrlResponse(accessToken = token)
                when (tokenCode) {
                    HttpURLConnection.HTTP_OK -> {
                        withContext(Dispatchers.Main) {
                            viewModel.startDownloadWithToken(token)
                        }
                    }
                    HttpURLConnection.HTTP_FORBIDDEN -> {
                        showAgreementSheet = true
                    }
                    else -> {
                        viewModel.setDownloadError("토큰이 만료되었거나 유효하지 않습니다.")
                    }
                }
                checkingAccess = false
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .imePadding()
    ) {
        // ===== Top Bar =====
        Surface(
            color = glassColors.surface,
            border = BorderStroke(0.5.dp, glassColors.border)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Outlined.AutoAwesome,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(22.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "${modelSize.displayName}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f)
                )
                if (messages.isNotEmpty()) {
                    IconButton(onClick = { viewModel.clearChat() }) {
                        Icon(
                            imageVector = Icons.Outlined.Refresh,
                            contentDescription = "초기화",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                IconButton(onClick = { showSettings = true }) {
                    Icon(
                        imageVector = Icons.Outlined.Settings,
                        contentDescription = "설정",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        // ===== Content Area =====
        if (!isModelDownloaded && !downloadProgress.isDownloading) {
            // Model not downloaded
            ModelSetupContent(
                modelSize = modelSize,
                downloadError = downloadError,
                isLoggedIn = isLoggedIn,
                tokenValidating = tokenValidating,
                tokenError = tokenError,
                checkingAccess = checkingAccess,
                onSelectModel = { viewModel.selectModel(it) },
                onDownloadClick = onDownloadClick,
                onValidateToken = { viewModel.validateAndSaveToken(it) },
                onLogoutHf = { viewModel.logoutHf() },
                onClearTokenError = { viewModel.clearTokenError() },
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
            )
        } else if (downloadProgress.isDownloading) {
            // Downloading
            DownloadingContent(
                downloadProgress = downloadProgress,
                onCancel = { viewModel.cancelDownload() },
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
            )
        } else {
            // Chat area
            Box(modifier = Modifier.weight(1f)) {
                if (messages.isEmpty() && !isGenerating) {
                    // Empty state
                    EmptyChatContent(
                        onQuickPrompt = { prompt ->
                            inputText = ""
                            viewModel.sendMessage(prompt)
                        }
                    )
                } else {
                    // Chat messages
                    LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(messages, key = { it.id }) { msg ->
                            ChatBubble(
                                role = msg.role,
                                content = msg.content,
                                imageBitmap = msg.imageBitmap,
                                attachedMessages = msg.attachedMessages
                            )
                        }
                        // Streaming indicator
                        if (isGenerating && streamingText.isNotEmpty()) {
                            item(key = "streaming") {
                                ChatBubble(ChatRole.AI, streamingText, isStreaming = true)
                            }
                        } else if (isGenerating) {
                            item(key = "loading") {
                                Row(
                                    modifier = Modifier.padding(start = 8.dp, top = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(16.dp),
                                        strokeWidth = 2.dp,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "생각하는 중...",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Input bar
            if (isModelDownloaded) {
                Surface(
                    color = glassColors.surface,
                    border = BorderStroke(0.5.dp, glassColors.border)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 8.dp)
                    ) {
                        // Image preview strip
                        if (pendingImage != null) {
                            ImagePreviewStrip(
                                bitmap = pendingImage!!,
                                onRemove = {
                                    pendingImage?.recycle()
                                    pendingImage = null
                                }
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                        }

                        // Message preview strip
                        if (pendingMessages.isNotEmpty()) {
                            MessagePreviewStrip(
                                messages = pendingMessages,
                                onRemove = { msg ->
                                    pendingMessages = pendingMessages.filter { it.id != msg.id }
                                }
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                        }

                        // Input row
                        Row(
                            verticalAlignment = Alignment.Bottom
                        ) {
                            // Attach button (+)
                            Box {
                                Surface(
                                    onClick = { showAttachMenu = true },
                                    shape = CircleShape,
                                    color = MaterialTheme.colorScheme.surfaceVariant,
                                    modifier = Modifier.size(40.dp)
                                ) {
                                    Box(
                                        contentAlignment = Alignment.Center,
                                        modifier = Modifier.fillMaxSize()
                                    ) {
                                        Icon(
                                            imageVector = Icons.Outlined.Add,
                                            contentDescription = "첨부",
                                            modifier = Modifier.size(20.dp),
                                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }
                                DropdownMenu(
                                    expanded = showAttachMenu,
                                    onDismissRequest = { showAttachMenu = false }
                                ) {
                                    DropdownMenuItem(
                                        text = { Text("갤러리") },
                                        onClick = {
                                            showAttachMenu = false
                                            galleryLauncher.launch(
                                                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                                            )
                                        },
                                        leadingIcon = {
                                            Icon(
                                                Icons.Outlined.Photo,
                                                contentDescription = null,
                                                modifier = Modifier.size(20.dp)
                                            )
                                        }
                                    )
                                    DropdownMenuItem(
                                        text = { Text("메시지 첨부") },
                                        onClick = {
                                            showAttachMenu = false
                                            viewModel.loadPickerMessages()
                                            pickerSelectedIds = pendingMessages.map { it.id }.toSet()
                                            showMessagePicker = true
                                        },
                                        leadingIcon = {
                                            Icon(
                                                Icons.AutoMirrored.Outlined.Chat,
                                                contentDescription = null,
                                                modifier = Modifier.size(20.dp)
                                            )
                                        }
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.width(8.dp))

                            // Text field
                            OutlinedTextField(
                                value = inputText,
                                onValueChange = { inputText = it },
                                modifier = Modifier.weight(1f),
                                placeholder = { Text("메시지를 입력하세요...") },
                                shape = RoundedCornerShape(20.dp),
                                maxLines = 4,
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = MaterialTheme.colorScheme.primary,
                                    unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)
                                )
                            )

                            Spacer(modifier = Modifier.width(4.dp))

                            // Mic button
                            Surface(
                                onClick = {
                                    if (isListening) {
                                        speechRecognizer.stopListening()
                                        isListening = false
                                    } else {
                                        micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                                    }
                                },
                                shape = CircleShape,
                                color = if (isListening)
                                    MaterialTheme.colorScheme.error
                                else
                                    MaterialTheme.colorScheme.surfaceVariant,
                                modifier = Modifier.size(40.dp)
                            ) {
                                Box(
                                    contentAlignment = Alignment.Center,
                                    modifier = Modifier.fillMaxSize()
                                ) {
                                    Icon(
                                        imageVector = Icons.Outlined.Mic,
                                        contentDescription = if (isListening) "녹음 중지" else "음성 입력",
                                        modifier = Modifier.size(20.dp),
                                        tint = if (isListening)
                                            MaterialTheme.colorScheme.onError
                                        else
                                            MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.width(4.dp))

                            // Send button
                            val canSend = (inputText.isNotBlank() || pendingImage != null || pendingMessages.isNotEmpty()) && !isGenerating
                            Surface(
                                onClick = {
                                    if (canSend) {
                                        val text = when {
                                            inputText.isNotBlank() -> inputText
                                            pendingMessages.isNotEmpty() -> "이 메시지를 분석해주세요."
                                            else -> "이 이미지를 설명해주세요."
                                        }
                                        val image = pendingImage
                                        val msgs = pendingMessages
                                        inputText = ""
                                        pendingImage = null
                                        pendingMessages = emptyList()
                                        viewModel.sendMessage(text, image, msgs)
                                    }
                                },
                                shape = CircleShape,
                                color = if (canSend)
                                    MaterialTheme.colorScheme.primary
                                else
                                    MaterialTheme.colorScheme.surfaceVariant,
                                modifier = Modifier.size(48.dp)
                            ) {
                                Box(
                                    contentAlignment = Alignment.Center,
                                    modifier = Modifier.fillMaxSize()
                                ) {
                                    Icon(
                                        imageVector = Icons.AutoMirrored.Filled.Send,
                                        contentDescription = "전송",
                                        modifier = Modifier.size(20.dp),
                                        tint = if (canSend)
                                            MaterialTheme.colorScheme.onPrimary
                                        else
                                            MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // ===== Settings Bottom Sheet =====
    if (showSettings) {
        val settingsSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { showSettings = false },
            sheetState = settingsSheetState,
            modifier = Modifier.fillMaxHeight()
        ) {
            SettingsSheetContent(
                modelSize = modelSize,
                isModelDownloaded = isModelDownloaded,
                downloadedFileSize = downloadedFileSize,
                presets = presets,
                selectedPresetId = selectedPresetId,
                onAddPreset = { name, content -> viewModel.addPreset(name, content) },
                onUpdatePreset = { id, name, content -> viewModel.updatePreset(id, name, content) },
                onDeletePreset = { viewModel.deletePreset(it) },
                onSelectPreset = { viewModel.selectPreset(it) },
                onSelectModel = { viewModel.selectModel(it) },
                onDeleteModel = { viewModel.deleteModel() },
                onDismiss = { showSettings = false }
            )
        }
    }

    // ===== Gated model agreement sheet =====
    if (showAgreementSheet) {
        ModalBottomSheet(
            onDismissRequest = {
                showAgreementSheet = false
                checkingAccess = false
            },
            sheetState = sheetState,
            modifier = Modifier.wrapContentHeight()
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(horizontal = 16.dp)
            ) {
                Text("라이선스 동의 필요", style = MaterialTheme.typography.titleLarge)
                Text(
                    "이 모델은 라이선스 동의가 필요합니다.\n아래 버튼을 눌러 동의한 후, 탭을 닫으면 다운로드가 시작됩니다.",
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(vertical = 16.dp)
                )
                Button(onClick = {
                    val downloadUrl = modelSize.downloadUrl
                    val index = downloadUrl.indexOf("/resolve/")
                    if (index >= 0) {
                        val agreementUrl = downloadUrl.substring(0, index)
                        val customTabsIntent = CustomTabsIntent.Builder().build()
                        customTabsIntent.intent.setData(Uri.parse(agreementUrl))
                        agreementLauncher.launch(customTabsIntent.intent)
                    }
                    showAgreementSheet = false
                }) {
                    Text("라이선스 페이지 열기")
                }
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }

    // ===== Network error dialog =====
    if (showErrorDialog) {
        AlertDialog(
            title = { Text("네트워크 오류") },
            text = { Text("인터넷 연결을 확인하세요.") },
            onDismissRequest = { showErrorDialog = false },
            confirmButton = {
                TextButton(onClick = { showErrorDialog = false }) { Text("닫기") }
            }
        )
    }

    // ===== Message Picker Fullscreen =====
    if (showMessagePicker) {
        MessagePickerScreen(
            messages = pickerMessages,
            categories = pickerCategories,
            selectedIds = pickerSelectedIds,
            onToggleSelection = { id ->
                pickerSelectedIds = if (id in pickerSelectedIds) {
                    pickerSelectedIds - id
                } else {
                    if (pickerSelectedIds.size < 5) pickerSelectedIds + id else pickerSelectedIds
                }
            },
            onConfirm = {
                pendingMessages = pickerMessages.filter { it.id in pickerSelectedIds }
                showMessagePicker = false
            },
            onDismiss = { showMessagePicker = false }
        )
    }
}

// ===== Image Preview Strip =====
@Composable
private fun ImagePreviewStrip(bitmap: Bitmap, onRemove: () -> Unit) {
    Box(
        modifier = Modifier.height(72.dp)
    ) {
        Image(
            bitmap = bitmap.asImageBitmap(),
            contentDescription = "첨부 이미지",
            modifier = Modifier
                .height(72.dp)
                .widthIn(max = 120.dp)
                .clip(RoundedCornerShape(12.dp)),
            contentScale = ContentScale.Crop
        )
        // Remove button
        Surface(
            onClick = onRemove,
            shape = CircleShape,
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier
                .size(20.dp)
                .align(Alignment.TopEnd)
        ) {
            Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                Icon(
                    imageVector = Icons.Outlined.Close,
                    contentDescription = "이미지 제거",
                    modifier = Modifier.size(14.dp),
                    tint = MaterialTheme.colorScheme.onError
                )
            }
        }
    }
}

// ===== Chat Bubble =====
@Composable
private fun ChatBubble(
    role: ChatRole,
    content: String,
    isStreaming: Boolean = false,
    imageBitmap: Bitmap? = null,
    attachedMessages: List<AttachedMessage> = emptyList()
) {
    val isUser = role == ChatRole.USER

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
    ) {
        Surface(
            shape = RoundedCornerShape(
                topStart = 16.dp,
                topEnd = 16.dp,
                bottomStart = if (isUser) 16.dp else 4.dp,
                bottomEnd = if (isUser) 4.dp else 16.dp
            ),
            color = if (isUser)
                MaterialTheme.colorScheme.primary
            else
                MaterialTheme.colorScheme.surfaceVariant,
            modifier = Modifier.widthIn(max = 300.dp)
        ) {
            Column {
                if (imageBitmap != null) {
                    Image(
                        bitmap = imageBitmap.asImageBitmap(),
                        contentDescription = "첨부 이미지",
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 200.dp)
                            .clip(
                                RoundedCornerShape(
                                    topStart = 16.dp,
                                    topEnd = 16.dp
                                )
                            ),
                        contentScale = ContentScale.Crop
                    )
                }
                // Attached messages quote block
                if (attachedMessages.isNotEmpty()) {
                    Column(
                        modifier = Modifier
                            .padding(start = 14.dp, end = 14.dp, top = 10.dp)
                            .fillMaxWidth()
                            .background(
                                if (isUser)
                                    MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.15f)
                                else
                                    MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.08f),
                                RoundedCornerShape(8.dp)
                            )
                            .padding(8.dp)
                    ) {
                        Text(
                            text = "첨부 메시지 ${attachedMessages.size}건",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.SemiBold,
                            color = if (isUser)
                                MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.8f)
                            else
                                MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.8f)
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        attachedMessages.forEach { msg ->
                            Text(
                                text = "${msg.sender}: ${msg.content}",
                                style = MaterialTheme.typography.bodySmall,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                                color = if (isUser)
                                    MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.7f)
                                else
                                    MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                            )
                        }
                    }
                }
                Text(
                    text = if (isStreaming) "$content..." else content,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (isUser)
                        MaterialTheme.colorScheme.onPrimary
                    else
                        MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun EmptyChatContent(onQuickPrompt: (String) -> Unit) {
    val quickPrompts = listOf(
        "오늘 날씨가 좋으면 뭘 하면 좋을까?",
        "간단한 한국어 농담 하나 해줘",
        "효과적인 시간 관리 팁 알려줘",
        "오늘 저녁 메뉴 추천해줘"
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Outlined.AutoAwesome,
            contentDescription = null,
            modifier = Modifier.size(48.dp),
            tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.6f)
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "AI에게 무엇이든 물어보세요",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = "온디바이스 AI가 답변합니다. 인터넷 불필요.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(24.dp))
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            quickPrompts.forEach { prompt ->
                AssistChip(
                    onClick = { onQuickPrompt(prompt) },
                    label = {
                        Text(
                            text = prompt,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            style = MaterialTheme.typography.bodySmall
                        )
                    },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Outlined.AutoAwesome,
                            contentDescription = null,
                            modifier = Modifier.size(14.dp)
                        )
                    },
                    colors = AssistChipDefaults.assistChipColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                    )
                )
            }
        }
    }
}

@Composable
private fun ModelSetupContent(
    modelSize: GemmaModelSize,
    downloadError: String?,
    isLoggedIn: Boolean,
    tokenValidating: Boolean,
    tokenError: String?,
    checkingAccess: Boolean,
    onSelectModel: (GemmaModelSize) -> Unit,
    onDownloadClick: () -> Unit,
    onValidateToken: (String) -> Unit,
    onLogoutHf: () -> Unit,
    onClearTokenError: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current

    Column(
        modifier = modifier
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Outlined.AutoAwesome,
            contentDescription = null,
            modifier = Modifier.size(56.dp),
            tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "AI 모델 설정",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = "AI 채팅을 사용하려면 모델을 다운로드하세요.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Model selection
        GlassSection(title = "모델 선택") {
            SegmentedSelector(
                options = GemmaModelSize.entries.map { size ->
                    "${size.displayName} (${size.displaySize})" to size
                },
                selected = modelSize,
                onSelect = onSelectModel
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = when (modelSize) {
                    GemmaModelSize.E2B -> "가벼운 모델 — 빠른 추론, 적은 메모리"
                    GemmaModelSize.E4B -> "고성능 모델 — 더 정확한 응답, 더 많은 메모리"
                },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        // HF Token
        GlassSection(title = "HuggingFace 토큰") {
            if (isLoggedIn) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Outlined.Key,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp),
                            tint = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "토큰 등록됨",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                    OutlinedButton(onClick = onLogoutHf) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Outlined.Logout,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("삭제")
                    }
                }
            } else {
                var tokenInput by rememberSaveable { mutableStateOf("") }
                var tokenVisible by rememberSaveable { mutableStateOf(false) }

                Text(
                    text = "Gemma 모델 다운로드에 HuggingFace 토큰이 필요합니다.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedButton(
                    onClick = {
                        val customTabsIntent = CustomTabsIntent.Builder().build()
                        customTabsIntent.intent.setData(
                            Uri.parse("https://huggingface.co/settings/tokens")
                        )
                        context.startActivity(customTabsIntent.intent)
                    },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Outlined.OpenInNew,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("토큰 발급 페이지")
                }

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = tokenInput,
                    onValueChange = {
                        tokenInput = it
                        onClearTokenError()
                    },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Access Token") },
                    placeholder = { Text("hf_...") },
                    leadingIcon = {
                        Icon(Icons.Outlined.Key, null, Modifier.size(20.dp))
                    },
                    trailingIcon = {
                        IconButton(onClick = { tokenVisible = !tokenVisible }) {
                            Icon(
                                imageVector = if (tokenVisible) Icons.Outlined.VisibilityOff
                                else Icons.Outlined.Visibility,
                                contentDescription = null
                            )
                        }
                    },
                    visualTransformation = if (tokenVisible) VisualTransformation.None
                    else PasswordVisualTransformation(),
                    singleLine = true,
                    enabled = !tokenValidating,
                    shape = RoundedCornerShape(12.dp)
                )

                if (tokenError != null) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = tokenError,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                Button(
                    onClick = { onValidateToken(tokenInput.trim()) },
                    enabled = !tokenValidating && tokenInput.isNotBlank(),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    if (tokenValidating) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.onPrimary
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("확인 중...")
                    } else {
                        Text("토큰 등록")
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Download
        if (downloadError != null) {
            Text(
                text = downloadError,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(bottom = 8.dp)
            )
        }

        Button(
            onClick = onDownloadClick,
            enabled = !checkingAccess,
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(
                imageVector = Icons.Outlined.Download,
                contentDescription = null,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
            if (checkingAccess) {
                Text("접근 확인 중...")
            } else {
                Text("모델 다운로드 (${modelSize.displaySize})")
            }
        }
    }
}

@Composable
private fun DownloadingContent(
    downloadProgress: com.hart.notimgmt.ai.DownloadProgress,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Outlined.Download,
            contentDescription = null,
            modifier = Modifier.size(48.dp),
            tint = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "모델 다운로드 중...",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold
        )
        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "${(downloadProgress.progress * 100).toInt()}%",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )

        Spacer(modifier = Modifier.height(12.dp))

        LinearProgressIndicator(
            progress = { downloadProgress.progress },
            modifier = Modifier.fillMaxWidth(),
            trackColor = MaterialTheme.colorScheme.surfaceVariant
        )

        Spacer(modifier = Modifier.height(8.dp))

        val downloadedMB = downloadProgress.bytesDownloaded / (1024 * 1024)
        val totalMB = downloadProgress.totalBytes / (1024 * 1024)
        Text(
            text = "${downloadedMB}MB / ${totalMB}MB",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(20.dp))

        OutlinedButton(onClick = onCancel) {
            Text("다운로드 취소")
        }
    }
}

@Composable
private fun SettingsSheetContent(
    modelSize: GemmaModelSize,
    isModelDownloaded: Boolean,
    downloadedFileSize: Long,
    presets: List<PromptPreset>,
    selectedPresetId: String,
    onAddPreset: (name: String, content: String) -> Unit,
    onUpdatePreset: (id: String, name: String, content: String) -> Unit,
    onDeletePreset: (id: String) -> Unit,
    onSelectPreset: (id: String) -> Unit,
    onSelectModel: (GemmaModelSize) -> Unit,
    onDeleteModel: () -> Unit,
    onDismiss: () -> Unit
) {
    var showPresetDialog by rememberSaveable { mutableStateOf(false) }
    var editingPreset by remember { mutableStateOf<PromptPreset?>(null) }

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text(
                text = "AI 설정",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 4.dp)
            )
        }

        item {
            GlassSection(title = "모델 선택") {
                SegmentedSelector(
                    options = GemmaModelSize.entries.map { size ->
                        "${size.displayName} (${size.displaySize})" to size
                    },
                    selected = modelSize,
                    onSelect = onSelectModel
                )
            }
        }

        if (isModelDownloaded) {
            item {
                GlassSection(title = "모델 관리") {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Storage,
                            contentDescription = null,
                            modifier = Modifier.size(20.dp),
                            tint = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "모델 설치됨",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.primary
                            )
                            val sizeMB = downloadedFileSize / (1024 * 1024)
                            Text(
                                text = "디스크 사용량: ${sizeMB}MB",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedButton(
                        onClick = onDeleteModel,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = MaterialTheme.colorScheme.error
                        ),
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.5f))
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.DeleteOutline,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("모델 삭제")
                    }
                }
            }
        }

        // Prompt presets section
        item {
            GlassSection(title = "프롬프트 지침") {
                Text(
                    text = "AI 응답 스타일이나 역할을 지정할 수 있습니다.\n프리셋을 선택하면 채팅에 적용됩니다.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(12.dp))

                if (presets.isEmpty()) {
                    Text(
                        text = "프리셋이 없습니다. 아래 버튼으로 추가하세요.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                        modifier = Modifier.padding(vertical = 8.dp)
                    )
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        presets.forEach { preset ->
                            val isSelected = preset.id == selectedPresetId
                            Surface(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp),
                                color = if (isSelected)
                                    MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
                                else
                                    MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
                                border = if (isSelected)
                                    BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.5f))
                                else
                                    BorderStroke(0.5.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.15f))
                            ) {
                                Row(
                                    modifier = Modifier
                                        .clickable { onSelectPreset(preset.id) }
                                        .padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        imageVector = if (isSelected) Icons.Outlined.CheckCircle
                                        else Icons.Outlined.RadioButtonUnchecked,
                                        contentDescription = if (isSelected) "선택됨" else "선택 안됨",
                                        modifier = Modifier.size(22.dp),
                                        tint = if (isSelected) MaterialTheme.colorScheme.primary
                                        else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                                    )
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = preset.name,
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = FontWeight.SemiBold,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        Text(
                                            text = preset.content,
                                            style = MaterialTheme.typography.bodySmall,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                    IconButton(
                                        onClick = {
                                            editingPreset = preset
                                            showPresetDialog = true
                                        },
                                        modifier = Modifier.size(32.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Outlined.Edit,
                                            contentDescription = "편집",
                                            modifier = Modifier.size(18.dp),
                                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                    IconButton(
                                        onClick = { onDeletePreset(preset.id) },
                                        modifier = Modifier.size(32.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Outlined.DeleteOutline,
                                            contentDescription = "삭제",
                                            modifier = Modifier.size(18.dp),
                                            tint = MaterialTheme.colorScheme.error
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))
                OutlinedButton(
                    onClick = {
                        editingPreset = null
                        showPresetDialog = true
                    },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Add,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("새 프리셋")
                }
            }
        }

        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f),
                        RoundedCornerShape(12.dp)
                    )
                    .padding(12.dp),
                verticalAlignment = Alignment.Top
            ) {
                Icon(
                    imageVector = Icons.Outlined.AutoAwesome,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.width(8.dp))
                Column {
                    Text(
                        text = "온디바이스 AI",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = "모든 처리는 기기에서 수행됩니다.\n인터넷 연결 없이 동작하며, 데이터가 외부로 전송되지 않습니다.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        item { Spacer(modifier = Modifier.height(12.dp)) }
    }

    // Preset add/edit dialog
    if (showPresetDialog) {
        PresetEditDialog(
            preset = editingPreset,
            onConfirm = { name, content ->
                if (editingPreset != null) {
                    onUpdatePreset(editingPreset!!.id, name, content)
                } else {
                    onAddPreset(name, content)
                }
                showPresetDialog = false
                editingPreset = null
            },
            onDismiss = {
                showPresetDialog = false
                editingPreset = null
            }
        )
    }
}

@Composable
private fun PresetEditDialog(
    preset: PromptPreset?,
    onConfirm: (name: String, content: String) -> Unit,
    onDismiss: () -> Unit
) {
    var name by rememberSaveable { mutableStateOf(preset?.name ?: "") }
    var content by rememberSaveable { mutableStateOf(preset?.content ?: "") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (preset != null) "프리셋 편집" else "프리셋 추가") },
        text = {
            Column {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("이름") },
                    placeholder = { Text("예: 한국어 응답") },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp)
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = content,
                    onValueChange = { content = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("프롬프트 내용") },
                    placeholder = { Text("예: 항상 한국어로 답변하세요") },
                    maxLines = 6,
                    shape = RoundedCornerShape(12.dp)
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { onConfirm(name.trim(), content.trim()) },
                enabled = name.isNotBlank() && content.isNotBlank()
            ) {
                Text("확인")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("취소")
            }
        }
    )
}

@Composable
private fun GlassSection(title: String, content: @Composable () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(0.5.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(12.dp))
            content()
        }
    }
}

// ===== Message Preview Strip =====
@Composable
private fun MessagePreviewStrip(
    messages: List<AttachedMessage>,
    onRemove: (AttachedMessage) -> Unit
) {
    LazyRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(messages, key = { it.id }) { msg ->
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.surface,
                border = BorderStroke(0.5.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.widthIn(max = 140.dp)) {
                        Text(
                            text = msg.sender,
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            text = msg.content,
                            style = MaterialTheme.typography.bodySmall,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Spacer(modifier = Modifier.width(4.dp))
                    Surface(
                        onClick = { onRemove(msg) },
                        shape = CircleShape,
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        modifier = Modifier.size(18.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                            Icon(
                                imageVector = Icons.Outlined.Close,
                                contentDescription = "제거",
                                modifier = Modifier.size(12.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }
    }
}

// ===== Message Picker Fullscreen =====
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MessagePickerScreen(
    messages: List<AttachedMessage>,
    categories: List<String>,
    selectedIds: Set<String>,
    onToggleSelection: (String) -> Unit,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    var searchQuery by rememberSaveable { mutableStateOf("") }
    var selectedCategory by rememberSaveable { mutableStateOf("") }
    var selectedSender by rememberSaveable { mutableStateOf("") }
    var showSenderDropdown by rememberSaveable { mutableStateOf(false) }

    // Date filter: 0=전체, 1=오늘, 7=이번 주, 30=이번 달
    var dateFilter by rememberSaveable { mutableStateOf(0) }

    val senders = remember(messages) {
        messages.map { it.sender }.distinct().sorted()
    }

    val dateFilterLabel = when (dateFilter) {
        1 -> "오늘"
        7 -> "이번 주"
        30 -> "이번 달"
        else -> "전체"
    }

    val now = remember { System.currentTimeMillis() }
    val filtered = remember(messages, searchQuery, selectedCategory, selectedSender, dateFilter) {
        messages.filter { msg ->
            val matchCategory = selectedCategory.isEmpty() || msg.categoryName == selectedCategory
            val matchSender = selectedSender.isEmpty() || msg.sender == selectedSender
            val matchDate = when (dateFilter) {
                1 -> (now - msg.receivedAt) < 24L * 60 * 60 * 1000
                7 -> (now - msg.receivedAt) < 7L * 24 * 60 * 60 * 1000
                30 -> (now - msg.receivedAt) < 30L * 24 * 60 * 60 * 1000
                else -> true
            }
            val matchSearch = if (searchQuery.isBlank()) true else {
                val q = searchQuery.lowercase()
                msg.sender.lowercase().contains(q) ||
                    msg.appName.lowercase().contains(q) ||
                    msg.content.lowercase().contains(q) ||
                    msg.categoryName.lowercase().contains(q)
            }
            matchCategory && matchSender && matchDate && matchSearch
        }
    }

    val hasActiveFilter = selectedCategory.isNotEmpty() || selectedSender.isNotEmpty() || dateFilter != 0

    BackHandler(onBack = onDismiss)

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = MaterialTheme.colorScheme.background
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
            // Top bar
            Surface(
                color = NotiRouteDesign.glassColors.surface,
                border = BorderStroke(0.5.dp, NotiRouteDesign.glassColors.border)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 8.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = onDismiss) {
                        Icon(
                            imageVector = Icons.Outlined.Close,
                            contentDescription = "닫기"
                        )
                    }
                    Text(
                        text = "메시지 첨부",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f)
                    )
                    Button(
                        onClick = onConfirm,
                        enabled = selectedIds.isNotEmpty()
                    ) {
                        Text("확인 (${selectedIds.size})")
                    }
                }
            }

            // Search bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                placeholder = { Text("카테고리, 발신자, 내용 검색...") },
                leadingIcon = {
                    Icon(Icons.Outlined.Search, contentDescription = null, modifier = Modifier.size(20.dp))
                },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { searchQuery = "" }) {
                            Icon(Icons.Outlined.Close, contentDescription = "지우기", modifier = Modifier.size(18.dp))
                        }
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = MaterialTheme.colorScheme.primary,
                    unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)
                )
            )

            // Filter chips row
            LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Date filter chip
                item {
                    FilterChip(
                        selected = dateFilter != 0,
                        onClick = {
                            dateFilter = when (dateFilter) {
                                0 -> 1
                                1 -> 7
                                7 -> 30
                                else -> 0
                            }
                        },
                        label = { Text(dateFilterLabel) },
                        leadingIcon = {
                            Icon(Icons.Outlined.CalendarToday, contentDescription = null, modifier = Modifier.size(16.dp))
                        }
                    )
                }

                // Category chips
                if (categories.isNotEmpty()) {
                    items(categories) { cat ->
                        FilterChip(
                            selected = selectedCategory == cat,
                            onClick = {
                                selectedCategory = if (selectedCategory == cat) "" else cat
                            },
                            label = { Text(cat) }
                        )
                    }
                }

                // Sender filter chip
                if (senders.size > 1) {
                    item {
                        Box {
                            FilterChip(
                                selected = selectedSender.isNotEmpty(),
                                onClick = { showSenderDropdown = true },
                                label = { Text(if (selectedSender.isNotEmpty()) selectedSender else "발신자") },
                                leadingIcon = {
                                    Icon(Icons.Outlined.Person, contentDescription = null, modifier = Modifier.size(16.dp))
                                }
                            )
                            DropdownMenu(
                                expanded = showSenderDropdown,
                                onDismissRequest = { showSenderDropdown = false }
                            ) {
                                DropdownMenuItem(
                                    text = { Text("전체") },
                                    onClick = {
                                        selectedSender = ""
                                        showSenderDropdown = false
                                    }
                                )
                                senders.forEach { sender ->
                                    DropdownMenuItem(
                                        text = { Text(sender, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                                        onClick = {
                                            selectedSender = sender
                                            showSenderDropdown = false
                                        }
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Active filter summary + clear
            if (hasActiveFilter) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "${filtered.size}건 일치",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.weight(1f)
                    )
                    TextButton(onClick = {
                        selectedCategory = ""
                        selectedSender = ""
                        dateFilter = 0
                        searchQuery = ""
                    }) {
                        Text("필터 초기화", style = MaterialTheme.typography.labelMedium)
                    }
                }
            }

            if (selectedIds.size >= 5) {
                Text(
                    text = "최대 5개까지 선택할 수 있습니다.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                )
            }

            // Message list
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(4.dp),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                modifier = Modifier.weight(1f)
            ) {
                items(filtered, key = { it.id }) { msg ->
                    PickerMessageRow(
                        message = msg,
                        isSelected = msg.id in selectedIds,
                        onToggle = { onToggleSelection(msg.id) }
                    )
                }
                if (filtered.isEmpty()) {
                    item {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 48.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.Search,
                                contentDescription = null,
                                modifier = Modifier.size(40.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f)
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = if (messages.isEmpty()) "캡쳐된 메시지가 없습니다." else "검색 결과가 없습니다.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }
        }
    }
}

@Composable
private fun PickerMessageRow(
    message: AttachedMessage,
    isSelected: Boolean,
    onToggle: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = if (isSelected)
            MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
        else
            MaterialTheme.colorScheme.surface,
        border = if (isSelected)
            BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.5f))
        else
            BorderStroke(0.5.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.15f))
    ) {
        Row(
            modifier = Modifier
                .clickable(onClick = onToggle)
                .padding(12.dp),
            verticalAlignment = Alignment.Top
        ) {
            Icon(
                imageVector = if (isSelected) Icons.Outlined.CheckCircle else Icons.Outlined.RadioButtonUnchecked,
                contentDescription = if (isSelected) "선택됨" else "선택 안됨",
                modifier = Modifier.size(22.dp),
                tint = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
            )
            Spacer(modifier = Modifier.width(10.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = message.sender,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = message.appName,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                        maxLines = 1
                    )
                }
                if (message.categoryName.isNotEmpty()) {
                    Text(
                        text = message.categoryName,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.tertiary,
                        maxLines = 1
                    )
                }
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = message.content,
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = formatRelativeTime(message.receivedAt),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                )
            }
        }
    }
}

// ===== Helper functions =====

private fun loadBitmapFromUri(context: Context, uri: Uri): Bitmap? {
    return try {
        // First pass: get dimensions only
        val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.contentResolver.openInputStream(uri)?.use { stream ->
            BitmapFactory.decodeStream(stream, null, options)
        }
        if (options.outWidth <= 0 || options.outHeight <= 0) return null

        // Calculate downsample factor targeting 512px
        val maxDim = maxOf(options.outWidth, options.outHeight)
        var sampleSize = 1
        while (maxDim / sampleSize > 512) {
            sampleSize *= 2
        }

        // Second pass: decode with downsample
        val decodeOptions = BitmapFactory.Options().apply { inSampleSize = sampleSize }
        context.contentResolver.openInputStream(uri)?.use { stream ->
            BitmapFactory.decodeStream(stream, null, decodeOptions)
        }
    } catch (e: Exception) {
        null
    }
}


