package com.hart.notimgmt.ui.components

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle

@Composable
fun PermissionHandler(content: @Composable () -> Unit) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    var isNotificationListenerEnabled by remember { mutableStateOf(checkNotificationListenerEnabled(context)) }
    var isSmsPermissionGranted by remember { mutableStateOf(checkSmsPermissions(context)) }
    var isPostNotificationsGranted by remember { mutableStateOf(checkPostNotificationsPermission(context)) }

    // Re-check permissions when the app resumes (e.g., returning from settings)
    LaunchedEffect(lifecycleOwner) {
        lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            isNotificationListenerEnabled = checkNotificationListenerEnabled(context)
            isSmsPermissionGranted = checkSmsPermissions(context)
            isPostNotificationsGranted = checkPostNotificationsPermission(context)
        }
    }

    // SMS permission launcher
    val smsPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        isSmsPermissionGranted = permissions.values.all { it }
    }

    // POST_NOTIFICATIONS permission launcher (Android 13+)
    val notificationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        isPostNotificationsGranted = granted
    }

    val allPermissionsGranted = isNotificationListenerEnabled
            && isSmsPermissionGranted
            && isPostNotificationsGranted

    if (allPermissionsGranted) {
        content()
    } else {
        PermissionRequestScreen(
            isNotificationListenerEnabled = isNotificationListenerEnabled,
            isSmsPermissionGranted = isSmsPermissionGranted,
            isPostNotificationsGranted = isPostNotificationsGranted,
            onOpenNotificationListenerSettings = {
                val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
                context.startActivity(intent)
            },
            onRequestSmsPermissions = {
                smsPermissionLauncher.launch(
                    arrayOf(
                        Manifest.permission.RECEIVE_SMS,
                        Manifest.permission.READ_SMS
                    )
                )
            },
            onRequestPostNotifications = {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
            }
        )
    }
}

@Composable
private fun PermissionRequestScreen(
    isNotificationListenerEnabled: Boolean,
    isSmsPermissionGranted: Boolean,
    isPostNotificationsGranted: Boolean,
    onOpenNotificationListenerSettings: () -> Unit,
    onRequestSmsPermissions: () -> Unit,
    onRequestPostNotifications: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "NotiRoute",
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "NotiRoute를 사용하려면 다음 권한이 필요합니다",
            style = MaterialTheme.typography.titleMedium,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(32.dp))

        if (!isNotificationListenerEnabled) {
            PermissionCard(
                title = "알림 접근 권한",
                description = "카카오톡/SMS 알림을 읽기 위해 필요합니다",
                buttonText = "설정으로 이동",
                onClick = onOpenNotificationListenerSettings
            )
            Spacer(modifier = Modifier.height(16.dp))
        }

        if (!isSmsPermissionGranted) {
            PermissionCard(
                title = "SMS 수신 권한",
                description = "SMS 메시지를 수신하기 위해 필요합니다",
                buttonText = "권한 허용",
                onClick = onRequestSmsPermissions
            )
            Spacer(modifier = Modifier.height(16.dp))
        }

        if (!isPostNotificationsGranted) {
            PermissionCard(
                title = "알림 권한",
                description = "앱 알림을 표시하기 위해 필요합니다",
                buttonText = "권한 허용",
                onClick = onRequestPostNotifications
            )
        }
    }
}

@Composable
private fun PermissionCard(
    title: String,
    description: String,
    buttonText: String,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = description,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(16.dp))
            Button(
                onClick = onClick,
                modifier = Modifier.align(Alignment.End)
            ) {
                Text(text = buttonText)
            }
        }
    }
}

private fun checkNotificationListenerEnabled(context: Context): Boolean {
    val enabledListeners = Settings.Secure.getString(
        context.contentResolver,
        "enabled_notification_listeners"
    )
    return enabledListeners?.contains(context.packageName) == true
}

private fun checkSmsPermissions(context: Context): Boolean {
    val receiveSms = ContextCompat.checkSelfPermission(
        context, Manifest.permission.RECEIVE_SMS
    ) == PackageManager.PERMISSION_GRANTED
    val readSms = ContextCompat.checkSelfPermission(
        context, Manifest.permission.READ_SMS
    ) == PackageManager.PERMISSION_GRANTED
    return receiveSms && readSms
}

private fun checkPostNotificationsPermission(context: Context): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        ContextCompat.checkSelfPermission(
            context, Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED
    } else {
        true // Not needed below Android 13
    }
}

