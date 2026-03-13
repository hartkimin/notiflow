package com.hart.notimgmt.ui.settings

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.hart.notimgmt.data.backup.BackupManager
import com.hart.notimgmt.data.backup.BackupSummary
import com.hart.notimgmt.data.backup.DataSummary
import com.hart.notimgmt.data.backup.ExportOptions
import com.hart.notimgmt.data.backup.RestoreOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun BackupRestoreSection(
    backupManager: BackupManager,
    onMessage: (String) -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var isLoading by remember { mutableStateOf(false) }
    var dataSummary by remember { mutableStateOf<DataSummary?>(null) }

    // Export dialog state
    var showExportDialog by remember { mutableStateOf(false) }
    var pendingExportOptions by remember { mutableStateOf<ExportOptions?>(null) }

    // Restore dialog state
    var showRestoreDialog by remember { mutableStateOf(false) }
    var pendingRestoreUri by remember { mutableStateOf<Uri?>(null) }
    var pendingBackupSummary by remember { mutableStateOf<BackupSummary?>(null) }

    // Load current data summary
    LaunchedEffect(Unit) {
        try {
            dataSummary = withContext(Dispatchers.IO) { backupManager.getDataSummary() }
        } catch (e: Exception) {
            onMessage("데이터 요약 로드 실패: ${e.message}")
        }
    }

    val exportLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/json")
    ) { uri ->
        uri ?: return@rememberLauncherForActivityResult
        val options = pendingExportOptions ?: ExportOptions()
        pendingExportOptions = null
        coroutineScope.launch {
            isLoading = true
            try {
                withContext(Dispatchers.IO) {
                    context.contentResolver.openOutputStream(uri)?.bufferedWriter()?.use { writer ->
                        val json = backupManager.exportToJson(options)
                        writer.write(json)
                    }
                }
                onMessage("백업이 완료되었습니다")
            } catch (e: Throwable) {
                val msg = if (e is OutOfMemoryError) "메모리 부족: 메시지를 제외하고 다시 시도해주세요"
                         else "백업 실패: ${e.message}"
                onMessage(msg)
            } finally {
                isLoading = false
            }
        }
    }

    val importLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri ->
        uri ?: return@rememberLauncherForActivityResult
        coroutineScope.launch {
            isLoading = true
            try {
                val json = withContext(Dispatchers.IO) {
                    context.contentResolver.openInputStream(uri)?.bufferedReader()?.readText() ?: ""
                }
                val summary = backupManager.parseBackupSummary(json)
                pendingRestoreUri = uri
                pendingBackupSummary = summary
                showRestoreDialog = true
            } catch (e: Throwable) {
                onMessage("파일을 읽을 수 없습니다: ${e.message}")
            } finally {
                isLoading = false
            }
        }
    }

    // Export selection dialog
    if (showExportDialog && dataSummary != null) {
        val summary = dataSummary!!
        var exportCategories by remember { mutableStateOf(summary.categoryCount + summary.filterRuleCount > 0) }
        var exportStatusSteps by remember { mutableStateOf(summary.statusStepCount > 0) }
        var exportMessages by remember { mutableStateOf(summary.messageCount > 0) }
        var exportAppFilters by remember { mutableStateOf(summary.appFilterCount > 0) }
        var exportPlans by remember { mutableStateOf(summary.planCount > 0) }
        var exportDayCategories by remember { mutableStateOf(summary.dayCategoryCount > 0) }

        val hasAnySelected = exportCategories || exportStatusSteps || exportMessages ||
                exportAppFilters || exportPlans || exportDayCategories

        AlertDialog(
            onDismissRequest = { showExportDialog = false },
            title = { Text("데이터 내보내기") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "내보낼 항목을 선택하세요.",
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
                                text = "내보낼 항목",
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

                            RestoreCheckboxRow(
                                label = "카테고리 & 필터 규칙",
                                count = categoriesCountText,
                                checked = exportCategories,
                                enabled = categoriesTotal > 0,
                                onCheckedChange = { exportCategories = it }
                            )
                            RestoreCheckboxRow(
                                label = "상태 단계",
                                count = "${summary.statusStepCount}개",
                                checked = exportStatusSteps,
                                enabled = summary.statusStepCount > 0,
                                onCheckedChange = { exportStatusSteps = it }
                            )
                            RestoreCheckboxRow(
                                label = "메시지",
                                count = "${summary.messageCount}개",
                                checked = exportMessages,
                                enabled = summary.messageCount > 0,
                                onCheckedChange = { exportMessages = it }
                            )
                            RestoreCheckboxRow(
                                label = "앱 필터",
                                count = "${summary.appFilterCount}개",
                                checked = exportAppFilters,
                                enabled = summary.appFilterCount > 0,
                                onCheckedChange = { exportAppFilters = it }
                            )
                            RestoreCheckboxRow(
                                label = "스케줄",
                                count = "${summary.planCount}개",
                                checked = exportPlans,
                                enabled = summary.planCount > 0,
                                onCheckedChange = { exportPlans = it }
                            )
                            RestoreCheckboxRow(
                                label = "요일 카테고리",
                                count = "${summary.dayCategoryCount}개",
                                checked = exportDayCategories,
                                enabled = summary.dayCategoryCount > 0,
                                onCheckedChange = { exportDayCategories = it }
                            )
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(
                    enabled = hasAnySelected,
                    onClick = {
                        pendingExportOptions = ExportOptions(
                            categories = exportCategories,
                            statusSteps = exportStatusSteps,
                            messages = exportMessages,
                            appFilters = exportAppFilters,
                            plans = exportPlans,
                            dayCategories = exportDayCategories
                        )
                        showExportDialog = false
                        val timestamp = SimpleDateFormat("yyyyMMdd_HHmm", Locale.getDefault())
                            .format(Date())
                        exportLauncher.launch("notiflow_backup_${timestamp}.json")
                    }
                ) {
                    Text("내보내기", color = if (hasAnySelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f))
                }
            },
            dismissButton = {
                TextButton(onClick = { showExportDialog = false }) {
                    Text("취소")
                }
            },
            containerColor = MaterialTheme.colorScheme.surface,
            shape = RoundedCornerShape(12.dp)
        )
    }

    // Restore confirmation dialog with backup preview + selective restore
    if (showRestoreDialog && pendingRestoreUri != null && pendingBackupSummary != null) {
        val summary = pendingBackupSummary!!
        val dateFormat = SimpleDateFormat("yyyy.MM.dd HH:mm", Locale.getDefault())
        val exportDate = if (summary.exportedAt > 0) dateFormat.format(Date(summary.exportedAt)) else "알 수 없음"

        // Checkbox states for selective restore
        var restoreCategories by remember { mutableStateOf(summary.categoryCount + summary.filterRuleCount > 0) }
        var restoreStatusSteps by remember { mutableStateOf(summary.statusStepCount > 0) }
        var restoreMessages by remember { mutableStateOf(summary.messageCount > 0) }
        var restoreAppFilters by remember { mutableStateOf(summary.appFilterCount > 0) }
        var restorePlans by remember { mutableStateOf(summary.planCount > 0) }
        var restoreDayCategories by remember { mutableStateOf(summary.dayCategoryCount > 0) }

        // 카테고리 미선택 시 요일 카테고리 자동 해제
        LaunchedEffect(restoreCategories) {
            if (!restoreCategories) restoreDayCategories = false
        }

        val hasAnySelected = restoreCategories || restoreStatusSteps || restoreMessages ||
                restoreAppFilters || restorePlans || restoreDayCategories

        AlertDialog(
            onDismissRequest = {
                showRestoreDialog = false
                pendingRestoreUri = null
                pendingBackupSummary = null
            },
            title = { Text("데이터 복원") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "아래 백업에서 선택한 항목을 복원합니다.",
                        style = MaterialTheme.typography.bodyMedium
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    // Backup info
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text(
                                text = "백업 정보",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            SummaryRow("백업 일시", exportDate)
                            SummaryRow("포맷 버전", "v${summary.formatVersion}")
                        }
                    }

                    // Restore item selection
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text(
                                text = "복원할 항목",
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

                            RestoreCheckboxRow(
                                label = "카테고리 & 필터 규칙",
                                count = categoriesCountText,
                                checked = restoreCategories,
                                enabled = categoriesTotal > 0,
                                onCheckedChange = { restoreCategories = it }
                            )
                            RestoreCheckboxRow(
                                label = "상태 단계",
                                count = "${summary.statusStepCount}개",
                                checked = restoreStatusSteps,
                                enabled = summary.statusStepCount > 0,
                                onCheckedChange = { restoreStatusSteps = it }
                            )
                            RestoreCheckboxRow(
                                label = "메시지",
                                count = "${summary.messageCount}개",
                                checked = restoreMessages,
                                enabled = summary.messageCount > 0,
                                onCheckedChange = { restoreMessages = it }
                            )
                            RestoreCheckboxRow(
                                label = "앱 필터",
                                count = "${summary.appFilterCount}개",
                                checked = restoreAppFilters,
                                enabled = summary.appFilterCount > 0,
                                onCheckedChange = { restoreAppFilters = it }
                            )
                            RestoreCheckboxRow(
                                label = "스케줄",
                                count = "${summary.planCount}개",
                                checked = restorePlans,
                                enabled = summary.planCount > 0,
                                onCheckedChange = { restorePlans = it }
                            )
                            RestoreCheckboxRow(
                                label = "요일 카테고리",
                                count = "${summary.dayCategoryCount}개",
                                checked = restoreDayCategories,
                                enabled = summary.dayCategoryCount > 0 && restoreCategories,
                                onCheckedChange = { restoreDayCategories = it }
                            )
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(
                    enabled = hasAnySelected,
                    onClick = {
                        val uri = pendingRestoreUri!!
                        val options = RestoreOptions(
                            categories = restoreCategories,
                            statusSteps = restoreStatusSteps,
                            messages = restoreMessages,
                            appFilters = restoreAppFilters,
                            plans = restorePlans,
                            dayCategories = restoreDayCategories
                        )
                        showRestoreDialog = false
                        pendingRestoreUri = null
                        pendingBackupSummary = null
                        coroutineScope.launch {
                            isLoading = true
                            try {
                                val json = withContext(Dispatchers.IO) {
                                    context.contentResolver.openInputStream(uri)
                                        ?.bufferedReader()?.readText() ?: ""
                                }
                                withContext(Dispatchers.IO) {
                                    backupManager.importFromJson(json, overwrite = true, options = options)
                                }
                                // Refresh summary after restore
                                dataSummary = withContext(Dispatchers.IO) {
                                    backupManager.getDataSummary()
                                }
                                // 선택된 항목 수 계산
                                var restoredCount = 0
                                if (options.categories) restoredCount += summary.categoryCount + summary.filterRuleCount
                                if (options.statusSteps) restoredCount += summary.statusStepCount
                                if (options.messages) restoredCount += summary.messageCount
                                if (options.appFilters) restoredCount += summary.appFilterCount
                                if (options.plans) restoredCount += summary.planCount
                                if (options.dayCategories) restoredCount += summary.dayCategoryCount
                                onMessage("복원이 완료되었습니다 (${restoredCount}건)")
                            } catch (e: Throwable) {
                                onMessage("복원 실패: ${e.message}")
                            } finally {
                                isLoading = false
                            }
                        }
                    }
                ) {
                    Text("덮어쓰기", color = if (hasAnySelected) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f))
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        showRestoreDialog = false
                        pendingRestoreUri = null
                        pendingBackupSummary = null
                    }
                ) {
                    Text("취소")
                }
            },
            containerColor = MaterialTheme.colorScheme.surface,
            shape = RoundedCornerShape(12.dp)
        )
    }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(0.5.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "데이터 백업/복원",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = "카테고리, 필터, 상태, 메시지, 스케줄을 JSON 파일로 내보내거나 복원합니다",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            // Current data summary
            AnimatedVisibility(
                visible = dataSummary != null,
                enter = expandVertically(),
                exit = shrinkVertically()
            ) {
                dataSummary?.let { summary ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 10.dp)
                            .background(
                                MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
                                RoundedCornerShape(8.dp)
                            )
                            .padding(10.dp)
                    ) {
                        Text(
                            text = "현재 데이터",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceEvenly
                        ) {
                            DataChip("메시지", summary.messageCount)
                            DataChip("카테고리", summary.categoryCount)
                            DataChip("필터", summary.filterRuleCount)
                            DataChip("스케줄", summary.planCount)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (isLoading) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 8.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "처리 중...",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                Row(modifier = Modifier.fillMaxWidth()) {
                    Button(
                        onClick = {
                            coroutineScope.launch {
                                try {
                                    dataSummary = withContext(Dispatchers.IO) { backupManager.getDataSummary() }
                                    showExportDialog = true
                                } catch (e: Exception) {
                                    onMessage("데이터 조회 실패: ${e.message}")
                                }
                            }
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary
                        )
                    ) {
                        Text("내보내기")
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    OutlinedButton(
                        onClick = { importLauncher.launch(arrayOf("application/json")) },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("복원하기")
                    }
                }
            }
        }
    }
}

@Composable
private fun DataChip(label: String, count: Int) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = "$count",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun RestoreCheckboxRow(
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
private fun SummaryRow(label: String, value: String, bold: Boolean = false) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 1.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal,
            textAlign = TextAlign.End
        )
    }
}
