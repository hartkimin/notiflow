package com.hart.notimgmt.ui.settings

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Cloud
import androidx.compose.material.icons.outlined.CloudDone
import androidx.compose.material.icons.outlined.CloudDownload
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.CloudUpload
import androidx.compose.material.icons.outlined.Error
import androidx.compose.material.icons.outlined.ExpandLess
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.HourglassEmpty
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.Sync
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.TextButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.hilt.navigation.compose.hiltViewModel
import com.hart.notimgmt.data.model.AppMode
import com.hart.notimgmt.data.model.ThemeMode
import com.hart.notimgmt.ui.components.ConfirmDialog
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import com.hart.notimgmt.util.checkBatteryOptimization
import com.hart.notimgmt.util.checkNotificationListener
import com.hart.notimgmt.util.checkPostNotifPermission
import com.hart.notimgmt.util.checkSmsPermission
import com.hart.notimgmt.data.backup.DataSummary
import com.hart.notimgmt.data.sync.SyncStatus
import com.hart.notimgmt.data.sync.TableSyncInfo
import com.hart.notimgmt.data.sync.TableSyncStatus
import com.hart.notimgmt.data.sync.DownloadOptions
import com.hart.notimgmt.data.sync.UploadOptions
import com.hart.notimgmt.ui.filter.SegmentedSelector
import com.hart.notimgmt.ui.navigation.LocalSnackbarHostState
import com.hart.notimgmt.viewmodel.AppFilterViewModel
import com.hart.notimgmt.viewmodel.SettingsViewModel
import kotlinx.coroutines.launch

@Composable
fun GeneralScreen(
    viewModel: AppFilterViewModel = hiltViewModel(),
    settingsViewModel: SettingsViewModel = hiltViewModel(),
    onLogout: () -> Unit = {},
    onNavigateToTutorial: () -> Unit = {},
    onSwitchToCloud: () -> Unit = {}
) {
    val themeMode by viewModel.themeMode.collectAsState()
    val captureNotifEnabled by viewModel.captureNotificationEnabled.collectAsState()
    val autoDeleteDays by viewModel.autoDeleteDays.collectAsState()
    val syncStatus by settingsViewModel.syncStatus.collectAsState()
    val syncState by settingsViewModel.syncState.collectAsState()
    val userEmail by settingsViewModel.userEmail.collectAsState()
    val isLoggedIn by settingsViewModel.isLoggedIn.collectAsState()
    val isLoggingOut by settingsViewModel.isLoggingOut.collectAsState()
    val appMode by settingsViewModel.appMode.collectAsState()
    val isCloudMode = appMode == AppMode.CLOUD
    val snackbarHostState = LocalSnackbarHostState.current
    val coroutineScope = rememberCoroutineScope()
    var showSyncDetails by remember { mutableStateOf(false) }
    var showSyncLogs by remember { mutableStateOf(false) }
    var showUploadDialog by remember { mutableStateOf(false) }
    var uploadDataSummary by remember { mutableStateOf<DataSummary?>(null) }
    var showDownloadDialog by remember { mutableStateOf(false) }
    var downloadDataSummary by remember { mutableStateOf<DataSummary?>(null) }
    var isLoadingRemoteSummary by remember { mutableStateOf(false) }
    var showSwitchToOfflineDialog by remember { mutableStateOf(false) }

    // Permission states
    val context = LocalContext.current
    var notificationListenerEnabled by remember { mutableStateOf(checkNotificationListener(context)) }
    var batteryOptimizationEnabled by remember { mutableStateOf(checkBatteryOptimization(context)) }
    var smsPermissionEnabled by remember { mutableStateOf(checkSmsPermission(context)) }
    var postNotifPermissionEnabled by remember { mutableStateOf(checkPostNotifPermission(context)) }

    // Auto-refresh permission states when screen resumes
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                notificationListenerEnabled = checkNotificationListener(context)
                batteryOptimizationEnabled = checkBatteryOptimization(context)
                smsPermissionEnabled = checkSmsPermission(context)
                postNotifPermissionEnabled = checkPostNotifPermission(context)
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp)
    ) {
        // ========== 그룹: 앱 설정 ==========
        SectionGroupHeader("앱 설정")

        // 테마 섹션
        SettingsSection(title = "테마") {
            SegmentedSelector(
                options = listOf(
                    "시스템" to ThemeMode.SYSTEM,
                    "라이트" to ThemeMode.LIGHT,
                    "다크" to ThemeMode.DARK
                ),
                selected = themeMode,
                onSelect = { viewModel.setThemeMode(it) }
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = when (themeMode) {
                    ThemeMode.SYSTEM -> "시스템 설정에 따라 자동으로 전환됩니다"
                    ThemeMode.LIGHT -> "항상 라이트 모드를 사용합니다"
                    ThemeMode.DARK -> "항상 다크 모드를 사용합니다"
                },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        // 알림 섹션
        SettingsSection(title = "캡처 알림") {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "새 메시지 알림",
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Text(
                        text = "메시지 캡처 시 상태바에 알림을 표시합니다",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Switch(
                    checked = captureNotifEnabled,
                    onCheckedChange = { viewModel.setCaptureNotificationEnabled(it) }
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // ========== 그룹: 권한 ==========
        SectionGroupHeader("권한")

        // 권한 설정 섹션
        SettingsSection(title = "권한 설정") {
            // 알림 접근 권한 (필수)
            PermissionStatusRow(
                name = "알림 접근 권한",
                description = "알림을 읽어 메시지를 캡처합니다",
                isGranted = notificationListenerEnabled,
                isRequired = true,
                onRequestPermission = {
                    val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
                    context.startActivity(intent)
                }
            )

            Spacer(modifier = Modifier.height(12.dp))

            // 배터리 최적화 제외 (필수)
            PermissionStatusRow(
                name = "배터리 최적화 제외",
                description = "백그라운드에서 안정적으로 동작합니다",
                isGranted = batteryOptimizationEnabled,
                isRequired = true,
                onRequestPermission = {
                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:${context.packageName}")
                    }
                    context.startActivity(intent)
                }
            )

            Spacer(modifier = Modifier.height(12.dp))

            // SMS 권한 (선택)
            PermissionStatusRow(
                name = "SMS 권한",
                description = "SMS 수신 시 추가 정보를 가져옵니다",
                isGranted = smsPermissionEnabled,
                isRequired = false,
                onRequestPermission = {
                    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.parse("package:${context.packageName}")
                    }
                    context.startActivity(intent)
                }
            )

            // POST_NOTIFICATIONS (Android 13+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                Spacer(modifier = Modifier.height(12.dp))

                PermissionStatusRow(
                    name = "알림 표시 권한",
                    description = "앱 알림을 표시합니다",
                    isGranted = postNotifPermissionEnabled,
                    isRequired = false,
                    onRequestPermission = {
                        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                            data = Uri.parse("package:${context.packageName}")
                        }
                        context.startActivity(intent)
                    }
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // ========== 그룹: 데이터 ==========
        SectionGroupHeader("데이터")

        // 업로드 선택 다이얼로그
        if (showUploadDialog && uploadDataSummary != null) {
            val summary = uploadDataSummary!!
            var uploadCategories by remember { mutableStateOf(summary.categoryCount + summary.filterRuleCount > 0) }
            var uploadStatusSteps by remember { mutableStateOf(summary.statusStepCount > 0) }
            var uploadMessages by remember { mutableStateOf(summary.messageCount > 0) }
            var uploadAppFilters by remember { mutableStateOf(summary.appFilterCount > 0) }
            var uploadPlans by remember { mutableStateOf(summary.planCount > 0) }
            var uploadDayCategories by remember { mutableStateOf(summary.dayCategoryCount > 0) }

            val hasAnySelected = uploadCategories || uploadStatusSteps || uploadMessages ||
                    uploadAppFilters || uploadPlans || uploadDayCategories

            AlertDialog(
                onDismissRequest = {
                    showUploadDialog = false
                    uploadDataSummary = null
                },
                title = { Text("클라우드 업로드") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            text = "서버에 업로드할 항목을 선택하세요.",
                            style = MaterialTheme.typography.bodyMedium
                        )

                        Spacer(modifier = Modifier.height(4.dp))

                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(8.dp),
                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text(
                                    text = "업로드할 항목",
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.primary
                                )
                                Spacer(modifier = Modifier.height(4.dp))

                                val categoriesTotal = summary.categoryCount + summary.filterRuleCount
                                val categoriesCountText = if (summary.filterRuleCount > 0) {
                                    "${summary.categoryCount}+${summary.filterRuleCount}개"
                                } else {
                                    "${summary.categoryCount}개"
                                }

                                UploadCheckboxRow(
                                    label = "카테고리 & 필터 규칙",
                                    count = categoriesCountText,
                                    checked = uploadCategories,
                                    enabled = categoriesTotal > 0,
                                    onCheckedChange = { uploadCategories = it }
                                )
                                UploadCheckboxRow(
                                    label = "상태 단계",
                                    count = "${summary.statusStepCount}개",
                                    checked = uploadStatusSteps,
                                    enabled = summary.statusStepCount > 0,
                                    onCheckedChange = { uploadStatusSteps = it }
                                )
                                UploadCheckboxRow(
                                    label = "메시지",
                                    count = "${summary.messageCount}개",
                                    checked = uploadMessages,
                                    enabled = summary.messageCount > 0,
                                    onCheckedChange = { uploadMessages = it }
                                )
                                UploadCheckboxRow(
                                    label = "앱 필터",
                                    count = "${summary.appFilterCount}개",
                                    checked = uploadAppFilters,
                                    enabled = summary.appFilterCount > 0,
                                    onCheckedChange = { uploadAppFilters = it }
                                )
                                UploadCheckboxRow(
                                    label = "스케줄",
                                    count = "${summary.planCount}개",
                                    checked = uploadPlans,
                                    enabled = summary.planCount > 0,
                                    onCheckedChange = { uploadPlans = it }
                                )
                                UploadCheckboxRow(
                                    label = "요일 카테고리",
                                    count = "${summary.dayCategoryCount}개",
                                    checked = uploadDayCategories,
                                    enabled = summary.dayCategoryCount > 0,
                                    onCheckedChange = { uploadDayCategories = it }
                                )
                            }
                        }
                    }
                },
                confirmButton = {
                    TextButton(
                        enabled = hasAnySelected,
                        onClick = {
                            val options = UploadOptions(
                                categories = uploadCategories,
                                statusSteps = uploadStatusSteps,
                                messages = uploadMessages,
                                appFilters = uploadAppFilters,
                                plans = uploadPlans,
                                dayCategories = uploadDayCategories
                            )
                            showUploadDialog = false
                            uploadDataSummary = null
                            showSyncDetails = true
                            showSyncLogs = true
                            settingsViewModel.triggerUploadSync(options)
                            coroutineScope.launch {
                                snackbarHostState.showSnackbar("업로드를 시작합니다")
                            }
                        }
                    ) {
                        Text("업로드", color = if (hasAnySelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f))
                    }
                },
                dismissButton = {
                    TextButton(
                        onClick = {
                            showUploadDialog = false
                            uploadDataSummary = null
                        }
                    ) {
                        Text("취소")
                    }
                },
                containerColor = MaterialTheme.colorScheme.surface,
                shape = RoundedCornerShape(12.dp)
            )
        }

        // 다운로드 선택 다이얼로그
        if (showDownloadDialog && downloadDataSummary != null) {
            val summary = downloadDataSummary!!
            var downloadCategories by remember { mutableStateOf(summary.categoryCount + summary.filterRuleCount > 0) }
            var downloadStatusSteps by remember { mutableStateOf(summary.statusStepCount > 0) }
            var downloadMessages by remember { mutableStateOf(summary.messageCount > 0) }
            var downloadAppFilters by remember { mutableStateOf(summary.appFilterCount > 0) }
            var downloadPlans by remember { mutableStateOf(summary.planCount > 0) }
            var downloadDayCategories by remember { mutableStateOf(summary.dayCategoryCount > 0) }

            val hasAnySelected = downloadCategories || downloadStatusSteps || downloadMessages ||
                    downloadAppFilters || downloadPlans || downloadDayCategories

            AlertDialog(
                onDismissRequest = {
                    showDownloadDialog = false
                    downloadDataSummary = null
                },
                title = { Text("클라우드 복원") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            text = "서버에서 복원할 항목을 선택하세요.",
                            style = MaterialTheme.typography.bodyMedium
                        )

                        Spacer(modifier = Modifier.height(4.dp))

                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(8.dp),
                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text(
                                    text = "서버 데이터",
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.primary
                                )
                                Spacer(modifier = Modifier.height(4.dp))

                                val categoriesTotal = summary.categoryCount + summary.filterRuleCount
                                val categoriesCountText = if (summary.filterRuleCount > 0) {
                                    "${summary.categoryCount}+${summary.filterRuleCount}개"
                                } else {
                                    "${summary.categoryCount}개"
                                }

                                UploadCheckboxRow(
                                    label = "카테고리 & 필터 규칙",
                                    count = categoriesCountText,
                                    checked = downloadCategories,
                                    enabled = categoriesTotal > 0,
                                    onCheckedChange = { downloadCategories = it }
                                )
                                UploadCheckboxRow(
                                    label = "상태 단계",
                                    count = "${summary.statusStepCount}개",
                                    checked = downloadStatusSteps,
                                    enabled = summary.statusStepCount > 0,
                                    onCheckedChange = { downloadStatusSteps = it }
                                )
                                UploadCheckboxRow(
                                    label = "메시지",
                                    count = "${summary.messageCount}개",
                                    checked = downloadMessages,
                                    enabled = summary.messageCount > 0,
                                    onCheckedChange = { downloadMessages = it }
                                )
                                UploadCheckboxRow(
                                    label = "앱 필터",
                                    count = "${summary.appFilterCount}개",
                                    checked = downloadAppFilters,
                                    enabled = summary.appFilterCount > 0,
                                    onCheckedChange = { downloadAppFilters = it }
                                )
                                UploadCheckboxRow(
                                    label = "스케줄",
                                    count = "${summary.planCount}개",
                                    checked = downloadPlans,
                                    enabled = summary.planCount > 0,
                                    onCheckedChange = { downloadPlans = it }
                                )
                                UploadCheckboxRow(
                                    label = "요일 카테고리",
                                    count = "${summary.dayCategoryCount}개",
                                    checked = downloadDayCategories,
                                    enabled = summary.dayCategoryCount > 0,
                                    onCheckedChange = { downloadDayCategories = it }
                                )
                            }
                        }
                    }
                },
                confirmButton = {
                    TextButton(
                        enabled = hasAnySelected,
                        onClick = {
                            val options = DownloadOptions(
                                categories = downloadCategories,
                                statusSteps = downloadStatusSteps,
                                messages = downloadMessages,
                                appFilters = downloadAppFilters,
                                plans = downloadPlans,
                                dayCategories = downloadDayCategories
                            )
                            showDownloadDialog = false
                            downloadDataSummary = null
                            showSyncDetails = true
                            showSyncLogs = true
                            settingsViewModel.triggerDownloadSync(options)
                            coroutineScope.launch {
                                snackbarHostState.showSnackbar("복원을 시작합니다")
                            }
                        }
                    ) {
                        Text("복원", color = if (hasAnySelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f))
                    }
                },
                dismissButton = {
                    TextButton(
                        onClick = {
                            showDownloadDialog = false
                            downloadDataSummary = null
                        }
                    ) {
                        Text("취소")
                    }
                },
                containerColor = MaterialTheme.colorScheme.surface,
                shape = RoundedCornerShape(12.dp)
            )
        }

        // 클라우드 동기화 섹션 (cloud mode only)
        if (isCloudMode) {
            SettingsSection(title = "클라우드 동기화") {
                // 동기화 상태
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    when {
                        !isLoggedIn -> {
                            Icon(
                                imageVector = Icons.Outlined.Cloud,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(24.dp)
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = "로그인이 필요합니다",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.weight(1f)
                            )
                            OutlinedButton(
                                onClick = onSwitchToCloud,
                                contentPadding = ButtonDefaults.ContentPadding
                            ) {
                                Text("로그인", style = MaterialTheme.typography.labelMedium)
                            }
                        }
                        syncStatus == SyncStatus.SYNCING -> {
                            CircularProgressIndicator(
                                modifier = Modifier.size(24.dp),
                                strokeWidth = 2.dp
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "동기화 중...",
                                    style = MaterialTheme.typography.bodyMedium
                                )
                                Text(
                                    text = "데이터를 동기화하고 있습니다",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                        syncStatus == SyncStatus.ERROR -> {
                            Icon(
                                imageVector = Icons.Outlined.CloudOff,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.error,
                                modifier = Modifier.size(24.dp)
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "동기화 오류",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.error
                                )
                                Text(
                                    text = syncState.lastErrorMessage ?: "네트워크 연결을 확인해주세요",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                            // 에러 해제 버튼
                            OutlinedButton(
                                onClick = { settingsViewModel.clearSyncError() },
                                modifier = Modifier.padding(start = 8.dp),
                                contentPadding = ButtonDefaults.ContentPadding
                            ) {
                                Text("해제", style = MaterialTheme.typography.labelSmall)
                            }
                        }
                        else -> {
                            // IDLE
                            Icon(
                                imageVector = Icons.Outlined.CloudDone,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(24.dp)
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "연결됨",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.primary
                                )
                                userEmail?.let { email ->
                                    Text(
                                        text = email,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }
                    }
                }

                // 마지막 동기화 시간
                if (isLoggedIn && syncState.lastSyncAt > 0 && syncStatus != SyncStatus.SYNCING) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "마지막 동기화: ${formatSyncTime(syncState.lastSyncAt)}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(start = 36.dp)
                    )
                }

                // 테이블별 동기화 상태 (접을 수 있음)
                if (isLoggedIn && (syncStatus == SyncStatus.SYNCING || syncState.tables.any { it.status != TableSyncStatus.PENDING })) {
                    Spacer(modifier = Modifier.height(12.dp))

                    // 테이블 상태 헤더
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .clickable { showSyncDetails = !showSyncDetails }
                            .padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "테이블별 동기화 상태",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.weight(1f)
                        )
                        Icon(
                            imageVector = if (showSyncDetails) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore,
                            contentDescription = null,
                            modifier = Modifier.size(20.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    AnimatedVisibility(
                        visible = showSyncDetails,
                        enter = expandVertically(),
                        exit = shrinkVertically()
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(
                                    MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
                                    RoundedCornerShape(8.dp)
                                )
                                .padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            syncState.tables.forEach { tableInfo ->
                                TableSyncStatusRow(tableInfo)
                            }
                        }
                    }
                }

                // 동기화 로그 (접을 수 있음)
                if (isLoggedIn && syncState.syncLogs.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(12.dp))

                    // 로그 헤더
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .clickable { showSyncLogs = !showSyncLogs }
                            .padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "동기화 로그",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.weight(1f)
                        )
                        Icon(
                            imageVector = if (showSyncLogs) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore,
                            contentDescription = null,
                            modifier = Modifier.size(20.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    AnimatedVisibility(
                        visible = showSyncLogs,
                        enter = expandVertically(),
                        exit = shrinkVertically()
                    ) {
                        LazyColumn(
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(max = 200.dp)
                                .background(
                                    MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
                                    RoundedCornerShape(8.dp)
                                )
                                .padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            items(syncState.syncLogs) { log ->
                                Text(
                                    text = log,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = when {
                                        log.contains("❌") -> MaterialTheme.colorScheme.error
                                        log.contains("✅") || log.contains("✓") -> MaterialTheme.colorScheme.primary
                                        log.contains("↑") -> MaterialTheme.colorScheme.tertiary
                                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                                    },
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // 업로드 / 복원 버튼
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = {
                            coroutineScope.launch {
                                uploadDataSummary = withContext(Dispatchers.IO) {
                                    viewModel.backupManager.getDataSummary()
                                }
                                showUploadDialog = true
                            }
                        },
                        enabled = isLoggedIn && syncStatus != SyncStatus.SYNCING,
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.CloudUpload,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("업로드")
                    }

                    OutlinedButton(
                        onClick = {
                            coroutineScope.launch {
                                isLoadingRemoteSummary = true
                                try {
                                    downloadDataSummary = withContext(Dispatchers.IO) {
                                        settingsViewModel.getRemoteDataSummary()
                                    }
                                    showDownloadDialog = true
                                } catch (e: Exception) {
                                    snackbarHostState.showSnackbar("서버 데이터 조회 실패: ${e.message}")
                                } finally {
                                    isLoadingRemoteSummary = false
                                }
                            }
                        },
                        enabled = isLoggedIn && syncStatus != SyncStatus.SYNCING && !isLoadingRemoteSummary,
                        modifier = Modifier.weight(1f)
                    ) {
                        if (isLoadingRemoteSummary) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp
                            )
                        } else {
                            Icon(
                                imageVector = Icons.Outlined.CloudDownload,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("복원")
                    }
                }

                // 로그아웃 버튼 (별도 행)
                if (isLoggedIn) {
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedButton(
                        onClick = { settingsViewModel.logout(onLogout) },
                        enabled = !isLoggingOut && syncStatus != SyncStatus.SYNCING,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = MaterialTheme.colorScheme.error
                        ),
                        border = BorderStroke(
                            1.dp,
                            MaterialTheme.colorScheme.error.copy(alpha = 0.5f)
                        )
                    ) {
                        if (isLoggingOut) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp,
                                color = MaterialTheme.colorScheme.error
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                        } else {
                            Icon(
                                imageVector = Icons.AutoMirrored.Outlined.Logout,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                        }
                        Text("로그아웃", style = MaterialTheme.typography.labelMedium)
                    }
                }

                // Switch to offline mode option
                if (isLoggedIn) {
                    Spacer(modifier = Modifier.height(4.dp))
                    TextButton(
                        onClick = { showSwitchToOfflineDialog = true },
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
            }
        }

        // Offline mode: show "Switch to Cloud" card
        if (!isCloudMode) {
            SettingsSection(title = "데이터 모드") {
                Surface(
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
                            imageVector = Icons.Outlined.CloudOff,
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
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedButton(
                    onClick = {
                        onSwitchToCloud()
                    },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Cloud,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("클라우드 모드로 전환", style = MaterialTheme.typography.labelMedium)
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // 백업/복원 섹션
        BackupRestoreSection(
            backupManager = viewModel.backupManager,
            onMessage = { msg ->
                coroutineScope.launch { snackbarHostState.showSnackbar(msg) }
            }
        )

        Spacer(modifier = Modifier.height(12.dp))

        // 자동 삭제 섹션
        SettingsSection(title = "자동 삭제") {
            SegmentedSelector(
                options = listOf(
                    "사용안함" to 0,
                    "30일" to 30,
                    "60일" to 60,
                    "90일" to 90
                ),
                selected = autoDeleteDays,
                onSelect = { viewModel.setAutoDeleteDays(it) }
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = if (autoDeleteDays == 0) "오래된 메시지를 자동으로 삭제하지 않습니다"
                else "${autoDeleteDays}일이 지난 메시지를 자동으로 삭제합니다 (보관된 메시지 제외)",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        // 데이터 초기화 섹션
        var showResetDialog by remember { mutableStateOf(false) }

        SettingsSection(title = "데이터 초기화") {
            Text(
                text = "모든 카테고리, 필터 규칙, 수집된 메시지, 상태 단계, 앱 필터 데이터를 삭제합니다.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(12.dp))

            Button(
                onClick = { showResetDialog = true },
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.errorContainer,
                    contentColor = MaterialTheme.colorScheme.onErrorContainer
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("모든 데이터 초기화")
            }
        }

        if (showSwitchToOfflineDialog) {
            ConfirmDialog(
                title = "오프라인 모드로 전환",
                message = "클라우드 동기화가 중단되고 로그아웃됩니다.\n로컬 데이터는 유지됩니다.\n\n계속하시겠습니까?",
                confirmText = "전환",
                onConfirm = {
                    showSwitchToOfflineDialog = false
                    settingsViewModel.switchToOffline { /* UI recomposes automatically via appMode StateFlow */ }
                },
                onDismiss = { showSwitchToOfflineDialog = false }
            )
        }

        if (showResetDialog) {
            ConfirmDialog(
                title = "앱 데이터 초기화",
                message = "모든 데이터가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.\n\n먼저 백업을 권장합니다.",
                confirmText = "초기화",
                onConfirm = {
                    showResetDialog = false
                    coroutineScope.launch {
                        try {
                            withContext(Dispatchers.IO) {
                                viewModel.backupManager.resetAllData()
                            }
                            snackbarHostState.showSnackbar("모든 데이터가 초기화되었습니다")
                        } catch (e: Exception) {
                            snackbarHostState.showSnackbar("초기화 실패: ${e.message}")
                        }
                    }
                },
                onDismiss = { showResetDialog = false }
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        // ========== 그룹: 정보 ==========
        SectionGroupHeader("정보")

        // 사용 안내 다시 보기
        SettingsSection(title = "사용 안내") {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .clickable { onNavigateToTutorial() }
                    .padding(vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "사용 안내 다시 보기",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium
                    )
                    Text(
                        text = "앱의 주요 기능을 다시 확인합니다",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // 앱 정보 섹션
        SettingsSection(title = "앱 정보") {
            Text(
                text = "NotiFlow",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
            Text(
                text = "알림의 흐름을 관리하세요",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        // 릴리즈 노트 섹션
        var showReleaseNotes by remember { mutableStateOf(false) }

        SettingsSection(title = "릴리즈 노트") {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .clickable { showReleaseNotes = !showReleaseNotes }
                    .padding(vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "버전 ${com.hart.notimgmt.BuildConfig.VERSION_NAME}",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = "최신 업데이트 내용을 확인하세요",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Icon(
                    imageVector = if (showReleaseNotes) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore,
                    contentDescription = null,
                    modifier = Modifier.size(24.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            AnimatedVisibility(
                visible = showReleaseNotes,
                enter = expandVertically(),
                exit = shrinkVertically()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 12.dp)
                        .background(
                            MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
                            RoundedCornerShape(8.dp)
                        )
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    ReleaseNoteItem(
                        version = "3.6.0",
                        date = "2026.02.23",
                        notes = listOf(
                            "오프라인 퍼스트 전환 — 로그인 없이 바로 앱 사용 가능",
                            "온보딩 간소화 — 모드 선택 페이지 제거 (3페이지)",
                            "클라우드 연동은 설정에서만 진행",
                            "로그아웃 시 자동 오프라인 전환",
                            "클라우드 동기화 로그인 버튼 동작 수정"
                        )
                    )

                    HorizontalDivider(
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                    )

                    ReleaseNoteItem(
                        version = "3.5.0",
                        date = "2026.02.21",
                        notes = listOf(
                            "대시보드 검색 고도화 — 메시지 내용 전문 검색 지원",
                            "앱별 필터 버튼 개선 — 아이콘 포함 필터 칩 UI",
                            "검색 토글 — 검색 아이콘 클릭으로 검색바 표시/숨김",
                            "날짜 표시 개선 — 대화방 목록에 날짜+시간 표시",
                            "검색 결과 매칭 건수 배지 표시",
                            "Supabase 동기화 확장 — room_name, attached_image 필드 추가",
                            "웹 대시보드 알림 페이지 연동",
                            "DB v24 마이그레이션"
                        )
                    )

                    HorizontalDivider(
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                    )

                    ReleaseNoteItem(
                        version = "3.4.1",
                        date = "2026.02.16",
                        notes = listOf(
                            "메시지 동기화 재시도 — 인증/네트워크 오류 시 자동 재시도",
                            "보류 메시지 추적 — needsSync 플래그로 실패한 동기화 영구 기록",
                            "앱 시작 시 보류 메시지 자동 동기화",
                            "연속 메시지 동기화 수정 — 개별 메시지 즉시 동기화로 전환",
                            "WorkManager 자동 재시도 — 네트워크 복구 시 자동 동기화",
                            "웹 대시보드 원격 동기화 — Realtime으로 동기화 요청 수신",
                            "Heartbeat 정확도 개선 — 동기화 성공 시 기기 정보 자동 갱신",
                            "동기화 실패 원인 로그 표시 개선",
                            "DB v22 마이그레이션"
                        )
                    )

                    HorizontalDivider(
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                    )

                    ReleaseNoteItem(
                        version = "3.4.0",
                        date = "2026.02.09",
                        notes = listOf(
                            "요일별 카테고리 선택 — 각 요일마다 원하는 카테고리를 개별 지정",
                            "미분류 메시지 연결 — 카테고리 없는 메시지를 어느 요일에서든 계획에 연결",
                            "스케쥴 탭 리네이밍 — 보드 → 스케쥴로 명칭 변경",
                            "스와이프 성능 개선 — 상하/좌우 중첩 페이저 제거, 주간 이동을 버튼 방식으로 전환",
                            "카테고리 추가/제거 UI — 날짜별 카테고리 피커 다이얼로그 추가",
                            "DB v18 마이그레이션, day_categories 테이블 추가",
                            "Supabase 동기화 및 백업 포맷 v7 연동"
                        )
                    )

                    HorizontalDivider(
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                    )

                    ReleaseNoteItem(
                        version = "3.3.0",
                        date = "2026.02.09",
                        notes = listOf(
                            "주간 계획 보드 — 칸반보드를 요일 기반 주간 계획으로 전환",
                            "카테고리별 계획 추가/완료/삭제, 메시지 연결, 주문번호 관리",
                            "주차 상하 스와이프, 요일 좌우 스와이프 네비게이션",
                            "달력 주 선택기 — 달력 아이콘으로 월별 캘린더에서 주 단위 이동",
                            "전주 계획 복사 (전체 주간/카테고리별), 다음 주 복사 기능",
                            "메시지 본문 수정 기능 — 수정 표시 및 원문보기 지원",
                            "앱 선택 UI 개선 — QUERY_ALL_PACKAGES 권한으로 설치된 모든 앱 표시, Switch 토글",
                            "설정 탭 UI 개선 — 일반 설정을 상단 탭으로 통합 (앱/키워드/상태/설정)",
                            "DB v17 마이그레이션, Supabase 동기화 및 백업 연동"
                        )
                    )

                    HorizontalDivider(
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                    )

                    ReleaseNoteItem(
                        version = "3.2.0",
                        date = "2026.02.09",
                        notes = listOf(
                            "카테고리 선택 UI 전면 개선 — ModalBottomSheet 전체화면 전환",
                            "카테고리 검색 기능 추가 (실시간 필터링, 결과 카운트 표시)",
                            "메시지 탭 스와이프 삭제/상태변경 제거 (오조작 방지)",
                            "필터 규칙 편집 UI 전면 개선 — ModalBottomSheet 전체화면 전환",
                            "AND 조건 버그 수정 — 발신자 키워드만 설정 시에도 정상 매칭"
                        )
                    )

                    HorizontalDivider(
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                    )

                    ReleaseNoteItem(
                        version = "3.1.0",
                        date = "2026.02.08",
                        notes = listOf(
                            "Hero Header 통합 — 상단 장식 헤더 제거, 컴팩트 Collapsing 헤더 적용",
                            "대시보드 검색바 추가 (스크롤 시 자동 축소)",
                            "메시지/보드 탭 스와이프 검색바 (아래로 스와이프 시 표시, 위로 스크롤 시 숨김)",
                            "보드 탭 검색 필터링 추가",
                            "앱 선택 UI 고도화 — 검색 기반 바텀시트 + 앱 아이콘 표시",
                            "온보딩/스플래시 배경을 NotiFlow 브랜드 벡터 이미지로 교체"
                        )
                    )

                    HorizontalDivider(
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                    )

                    ReleaseNoteItem(
                        version = "3.0.0",
                        date = "2026.02.08",
                        notes = listOf(
                            "NotiFlow로 리브랜딩 (MedNoti → NotiFlow)",
                            "새 앱 아이콘 (벨 + Flow 웨이브 + N 뱃지)",
                            "온보딩 화면 텍스트 및 브랜딩 업데이트",
                            "applicationId 변경 (com.hart.notiflow)"
                        )
                    )

                    HorizontalDivider(
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                    )

                    ReleaseNoteItem(
                        version = "2.7.0",
                        date = "2026.02.07",
                        notes = listOf(
                            "상태 변경 이력 타임라인 추가 (알림 상세 화면)",
                            "상태 변경 시 시간/이전→이후 상태 자동 기록"
                        )
                    )

                    HorizontalDivider(
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                    )

                    ReleaseNoteItem(
                        version = "2.6.0",
                        date = "2026.02.07",
                        notes = listOf(
                            "보드(칸반) 탭 타임라인 스타일 적용 (날짜 그룹 헤더, 앱 아이콘, 발신자 프로필, 카테고리 태그)",
                            "대시보드 타임라인 스타일 적용 (미처리/완료 섹션)",
                            "설정 > 일반 화면 배치 최적화 (논리 그룹별 재배치)"
                        )
                    )

                    HorizontalDivider(
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                    )

                    ReleaseNoteItem(
                        version = "2.5.0",
                        date = "2026.02.07",
                        notes = listOf(
                            "발신자 프로필 사진 표시",
                            "타임라인 앱 아이콘 하단 시간 표시",
                            "알림 상세 앱 아이콘 및 프로필 반영",
                            "백업/복원 FK 에러 수정"
                        )
                    )

                    HorizontalDivider(
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                    )

                    ReleaseNoteItem(
                        version = "2.4.0",
                        date = "2026.02.07",
                        notes = listOf(
                            "코멘트 타임라인 기능 추가 (다중 코멘트 지원)",
                            "코멘트 추가/삭제 기능",
                            "기존 단일 코멘트 자동 호환"
                        )
                    )

                    HorizontalDivider(
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                    )

                    ReleaseNoteItem(
                        version = "2.3.0",
                        date = "2026.02.07 12:29",
                        notes = listOf(
                            "앱 데이터 초기화 기능 추가",
                            "카테고리 복사 기능 추가 (필터 규칙 포함)",
                            "필터 규칙 편집 화면 개선"
                        )
                    )

                    HorizontalDivider(
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                    )

                    ReleaseNoteItem(
                        version = "2.2.0",
                        date = "2026.02.06 14:00",
                        notes = listOf(
                            "카테고리 우선순위 순서 변경 기능 추가",
                            "필터 화면에서 카테고리 위/아래 이동 버튼 추가",
                            "우선순위 안내 문구 표시",
                            "카테고리 활성화/비활성화 토글 추가",
                            "수집된 메시지 카테고리 변경 기능 추가"
                        )
                    )

                    HorizontalDivider(
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                    )

                    ReleaseNoteItem(
                        version = "2.1.0",
                        date = "2026.02.05 22:00",
                        notes = listOf(
                            "홈 화면 위젯 추가 (오늘/미처리/긴급 현황)",
                            "필터 규칙 개선 - 키워드별 활성화/비활성화 토글",
                            "필터 로직 변경 - 발신자 AND 내용 키워드 조합",
                            "메시지 수신 시 위젯 자동 업데이트",
                            "최초 설치 시 권한 설정 온보딩 화면",
                            "설정 > 일반에서 권한 상태 확인 및 관리"
                        )
                    )

                    HorizontalDivider(
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                    )

                    ReleaseNoteItem(
                        version = "2.0.0",
                        date = "2026.02.05 10:00",
                        notes = listOf(
                            "클라우드 동기화 기능 추가",
                            "TWS 테마 디자인 적용",
                            "대시보드 캘린더 뷰 추가",
                            "일괄 삭제 기능 추가",
                            "성능 및 안정성 개선"
                        )
                    )

                    HorizontalDivider(
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                    )

                    ReleaseNoteItem(
                        version = "1.0.0",
                        date = "2026.02.04 19:00",
                        notes = listOf(
                            "앱 최초 출시",
                            "알림 캡처 및 관리",
                            "카테고리 필터링",
                            "앱별 필터 설정"
                        )
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "Developed by Hart with AI",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(32.dp))
    }
}

@Composable
private fun SectionGroupHeader(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.primary,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
    )
}

@Composable
private fun SettingsSection(title: String, content: @Composable () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
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

@Composable
private fun ReleaseNoteItem(
    version: String,
    date: String,
    notes: List<String>
) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "v$version",
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.primary
            )
            Text(
                text = date,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Spacer(modifier = Modifier.height(4.dp))
        notes.forEach { note ->
            Row(
                modifier = Modifier.padding(start = 4.dp, top = 2.dp),
                verticalAlignment = Alignment.Top
            ) {
                Text(
                    text = "•",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = note,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun TableSyncStatusRow(tableInfo: TableSyncInfo) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // 상태 아이콘
        val (icon, tint) = when (tableInfo.status) {
            TableSyncStatus.PENDING -> Icons.Outlined.HourglassEmpty to MaterialTheme.colorScheme.onSurfaceVariant
            TableSyncStatus.PULLING -> Icons.Outlined.CloudDownload to MaterialTheme.colorScheme.tertiary
            TableSyncStatus.PUSHING -> Icons.Outlined.CloudUpload to MaterialTheme.colorScheme.tertiary
            TableSyncStatus.COMPLETED -> Icons.Outlined.CheckCircle to MaterialTheme.colorScheme.primary
            TableSyncStatus.ERROR -> Icons.Outlined.Error to MaterialTheme.colorScheme.error
        }

        if (tableInfo.status == TableSyncStatus.PULLING || tableInfo.status == TableSyncStatus.PUSHING) {
            CircularProgressIndicator(
                modifier = Modifier.size(16.dp),
                strokeWidth = 2.dp,
                color = tint
            )
        } else {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(16.dp),
                tint = tint
            )
        }

        Spacer(modifier = Modifier.width(8.dp))

        // 테이블 이름
        Text(
            text = tableInfo.displayName,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.weight(1f)
        )

        // 상태 텍스트
        val statusText = when (tableInfo.status) {
            TableSyncStatus.PENDING -> "대기 중"
            TableSyncStatus.PULLING -> "가져오는 중..."
            TableSyncStatus.PUSHING -> "업로드 중..."
            TableSyncStatus.COMPLETED -> {
                val pulled = if (tableInfo.pulledCount > 0) "↓${tableInfo.pulledCount}" else ""
                val pushed = if (tableInfo.pushedCount > 0) "↑${tableInfo.pushedCount}" else ""
                listOf(pulled, pushed).filter { it.isNotEmpty() }.joinToString(" ").ifEmpty { "완료" }
            }
            TableSyncStatus.ERROR -> "오류"
        }

        Text(
            text = statusText,
            style = MaterialTheme.typography.labelSmall,
            color = when (tableInfo.status) {
                TableSyncStatus.ERROR -> MaterialTheme.colorScheme.error
                TableSyncStatus.COMPLETED -> MaterialTheme.colorScheme.primary
                else -> MaterialTheme.colorScheme.onSurfaceVariant
            }
        )
    }
}

@Composable
private fun UploadCheckboxRow(
    label: String,
    count: String,
    checked: Boolean,
    enabled: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(36.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Checkbox(
            checked = checked && enabled,
            onCheckedChange = { if (enabled) onCheckedChange(it) },
            enabled = enabled,
            modifier = Modifier.size(20.dp)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = if (enabled) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f),
            modifier = Modifier.weight(1f)
        )
        Text(
            text = count,
            style = MaterialTheme.typography.bodySmall,
            color = if (enabled) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f),
            textAlign = TextAlign.End
        )
    }
}

@Composable
private fun PermissionStatusRow(
    name: String,
    description: String,
    isGranted: Boolean,
    isRequired: Boolean,
    onRequestPermission: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .clickable { if (!isGranted) onRequestPermission() }
            .background(
                if (isGranted) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
                else if (isRequired) MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f)
                else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
                RoundedCornerShape(8.dp)
            )
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // 상태 아이콘
        Box(
            modifier = Modifier
                .size(32.dp)
                .background(
                    if (isGranted) MaterialTheme.colorScheme.primary
                    else if (isRequired) MaterialTheme.colorScheme.error
                    else MaterialTheme.colorScheme.outline,
                    CircleShape
                ),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = if (isGranted) Icons.Outlined.CheckCircle else Icons.Outlined.Error,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
                tint = if (isGranted) MaterialTheme.colorScheme.onPrimary
                else if (isRequired) MaterialTheme.colorScheme.onError
                else MaterialTheme.colorScheme.surface
            )
        }

        Spacer(modifier = Modifier.width(12.dp))

        // 권한 정보
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = name,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )
                if (isRequired) {
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "필수",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier
                            .background(
                                MaterialTheme.colorScheme.errorContainer,
                                RoundedCornerShape(4.dp)
                            )
                            .padding(horizontal = 4.dp, vertical = 1.dp)
                    )
                }
            }
            Text(
                text = description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        // 상태 텍스트
        Text(
            text = if (isGranted) "허용됨" else "설정 필요",
            style = MaterialTheme.typography.labelMedium,
            color = if (isGranted) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
        )
    }
}

private fun formatSyncTime(timestamp: Long): String {
    if (timestamp <= 0) return "없음"
    val now = System.currentTimeMillis()
    val diff = now - timestamp
    val minutes = diff / (1000 * 60)
    val hours = minutes / 60
    val days = hours / 24

    return when {
        minutes < 1 -> "방금 전"
        minutes < 60 -> "${minutes}분 전"
        hours < 24 -> "${hours}시간 전"
        days < 7 -> "${days}일 전"
        else -> {
            val sdf = java.text.SimpleDateFormat("M/d HH:mm", java.util.Locale.getDefault())
            sdf.format(java.util.Date(timestamp))
        }
    }
}
