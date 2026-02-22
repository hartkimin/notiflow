package com.hart.notimgmt.ui.onboarding

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BatteryChargingFull
import androidx.compose.material.icons.filled.Category
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Rocket
import androidx.compose.material.icons.filled.Sms
import androidx.compose.material.icons.filled.TaskAlt
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.hart.notimgmt.R
import com.hart.notimgmt.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun OnboardingScreen(onComplete: () -> Unit) {
    val pagerState = rememberPagerState(pageCount = { 3 })
    val coroutineScope = rememberCoroutineScope()
    val glassColors = NotiFlowDesign.glassColors
    val context = LocalContext.current

    // 권한 상태 체크
    var allRequiredPermissionsGranted by remember { mutableStateOf(false) }

    val lifecycleOwner = LocalLifecycleOwner.current
    LaunchedEffect(lifecycleOwner) {
        lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            allRequiredPermissionsGranted = checkNotificationListener(context)
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        // NotiFlow 배경
        AsyncImage(
            model = ImageRequest.Builder(LocalContext.current)
                .data(R.drawable.notiflow_onboarding_bg)
                .crossfade(true)
                .build(),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize()
        )

        // 그라데이션 오버레이
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    brush = Brush.verticalGradient(
                        colors = listOf(
                            glassColors.gradientStart.copy(alpha = 0.7f),
                            glassColors.gradientMiddle.copy(alpha = 0.5f),
                            glassColors.gradientEnd.copy(alpha = 0.8f)
                        )
                    )
                )
        )

        Column(
            modifier = Modifier.fillMaxSize()
        ) {
            // 건너뛰기 버튼 (권한 페이지에서는 숨김)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.End
            ) {
                if (pagerState.currentPage == 0) {
                    TextButton(onClick = {
                        coroutineScope.launch {
                            pagerState.animateScrollToPage(1)
                        }
                    }) {
                        Text(
                            "건너뛰기",
                            color = TwsWhite.copy(alpha = 0.8f)
                        )
                    }
                } else {
                    // 공간 유지
                    Spacer(modifier = Modifier.height(48.dp))
                }
            }

            // 페이지 컨텐츠
            HorizontalPager(
                state = pagerState,
                modifier = Modifier.weight(1f),
                userScrollEnabled = pagerState.currentPage != 1 // 권한 페이지에서는 스와이프 비활성화
            ) { page ->
                when (page) {
                    0 -> IntroPage()
                    1 -> PermissionPage()
                    2 -> ReadyPage()
                }
            }

            // 페이지 인디케이터 + 버튼 (글래스 바)
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = TwsGlassWhite,
                border = BorderStroke(1.dp, TwsGlassBorderLight)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Dot indicators
                    Row(
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        repeat(3) { index ->
                            val color by animateColorAsState(
                                targetValue = if (index == pagerState.currentPage)
                                    TwsSkyBlue
                                else
                                    TwsSkyBlue.copy(alpha = 0.3f),
                                label = "dot"
                            )
                            Box(
                                modifier = Modifier
                                    .size(if (index == pagerState.currentPage) 10.dp else 8.dp)
                                    .clip(CircleShape)
                                    .background(color)
                            )
                            if (index < 2) Spacer(modifier = Modifier.width(8.dp))
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    // 권한 페이지에서는 필수 권한이 설정되어야 다음으로 진행 가능
                    val canProceed = when (pagerState.currentPage) {
                        1 -> allRequiredPermissionsGranted
                        else -> true
                    }

                    // 다음/시작하기 버튼
                    Button(
                        onClick = {
                            if (pagerState.currentPage < 2) {
                                coroutineScope.launch {
                                    pagerState.animateScrollToPage(pagerState.currentPage + 1)
                                }
                            } else {
                                onComplete()
                            }
                        },
                        enabled = canProceed,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = TwsSkyBlue,
                            disabledContainerColor = TwsSkyBlue.copy(alpha = 0.4f)
                        )
                    ) {
                        Text(
                            text = when {
                                pagerState.currentPage == 1 && !canProceed -> "알림 접근 권한을 설정해주세요"
                                pagerState.currentPage < 2 -> "다음"
                                else -> "시작하기"
                            },
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = TwsWhite
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun IntroPage() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // 글래스 아이콘 컨테이너
        Surface(
            modifier = Modifier
                .size(100.dp),
            shape = RoundedCornerShape(28.dp),
            color = TwsGlassWhite,
            border = BorderStroke(1.5.dp, TwsGlassBorderLight)
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier.fillMaxSize()
            ) {
                Icon(
                    imageVector = Icons.Default.NotificationsActive,
                    contentDescription = null,
                    modifier = Modifier.size(48.dp),
                    tint = TwsSkyBlue
                )
            }
        }

        Spacer(modifier = Modifier.height(32.dp))

        Text(
            text = "알림의 흐름을\n한눈에 관리하세요",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
            color = TwsWhite
        )

        Spacer(modifier = Modifier.height(40.dp))

        // 글래스 카드로 기능 설명
        Surface(
            modifier = Modifier
                .fillMaxWidth(),
            shape = RoundedCornerShape(20.dp),
            color = TwsGlassWhite,
            border = BorderStroke(1.dp, TwsGlassBorderLight)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                FeatureItem(
                    icon = Icons.Default.NotificationsActive,
                    title = "알림 자동 수집",
                    description = "선택한 앱의 알림과 SMS를 자동으로 캡처합니다"
                )
                Spacer(modifier = Modifier.height(16.dp))
                FeatureItem(
                    icon = Icons.Default.Category,
                    title = "스마트 분류",
                    description = "필터 규칙으로 메시지를 카테고리별로 자동 정리합니다"
                )
                Spacer(modifier = Modifier.height(16.dp))
                FeatureItem(
                    icon = Icons.Default.TaskAlt,
                    title = "상태 보드",
                    description = "칸반 보드로 업무 흐름을 시각적으로 관리합니다"
                )
            }
        }
    }
}

@Composable
private fun FeatureItem(icon: ImageVector, title: String, description: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(44.dp)
                .clip(CircleShape)
                .background(TwsSkyBlue.copy(alpha = 0.15f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(22.dp),
                tint = TwsSkyBlue
            )
        }
        Spacer(modifier = Modifier.width(14.dp))
        Column {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = TwsSkyBlueDark
            )
            Text(
                text = description,
                style = MaterialTheme.typography.bodySmall,
                color = TwsSkyBlueDark.copy(alpha = 0.7f)
            )
        }
    }
}

@Composable
private fun PermissionPage() {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    var isNotificationListenerEnabled by remember {
        mutableStateOf(checkNotificationListener(context))
    }
    var isSmsGranted by remember {
        mutableStateOf(checkSmsPermission(context))
    }
    var isPostNotifGranted by remember {
        mutableStateOf(checkPostNotifPermission(context))
    }
    var isBatteryOptimizationDisabled by remember {
        mutableStateOf(checkBatteryOptimization(context))
    }

    LaunchedEffect(lifecycleOwner) {
        lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            isNotificationListenerEnabled = checkNotificationListener(context)
            isSmsGranted = checkSmsPermission(context)
            isPostNotifGranted = checkPostNotifPermission(context)
            isBatteryOptimizationDisabled = checkBatteryOptimization(context)
        }
    }

    val smsLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        isSmsGranted = permissions.values.all { it }
    }

    val notifLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        isPostNotifGranted = granted
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "권한 설정",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = TwsWhite
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "앱이 정상 동작하려면 다음 권한이 필요합니다",
            style = MaterialTheme.typography.bodyMedium,
            color = TwsWhite.copy(alpha = 0.8f),
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(24.dp))

        // 필수 권한
        Text(
            text = "필수 권한",
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            color = TwsWhite.copy(alpha = 0.9f),
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(8.dp))

        PermissionCard(
            icon = Icons.Default.NotificationsActive,
            title = "알림 접근 권한",
            description = "앱 알림을 읽기 위해 필요합니다",
            isGranted = isNotificationListenerEnabled,
            isRequired = true,
            onRequest = {
                context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
            }
        )

        Spacer(modifier = Modifier.height(12.dp))

        PermissionCard(
            icon = Icons.Default.BatteryChargingFull,
            title = "배터리 최적화 제외",
            description = "백그라운드에서 안정적으로 동작합니다",
            isGranted = isBatteryOptimizationDisabled,
            isRequired = false,
            onRequest = {
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:${context.packageName}")
                }
                context.startActivity(intent)
            }
        )

        Spacer(modifier = Modifier.height(20.dp))

        // 선택 권한
        Text(
            text = "선택 권한",
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            color = TwsWhite.copy(alpha = 0.9f),
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(8.dp))

        PermissionCard(
            icon = Icons.Default.Sms,
            title = "SMS 수신 권한",
            description = "SMS 메시지를 수신하기 위해 필요합니다",
            isGranted = isSmsGranted,
            isRequired = false,
            onRequest = {
                smsLauncher.launch(
                    arrayOf(Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS)
                )
            }
        )

        Spacer(modifier = Modifier.height(12.dp))

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            PermissionCard(
                icon = Icons.Default.NotificationsActive,
                title = "알림 표시 권한",
                description = "새 메시지 알림을 표시하기 위해 필요합니다",
                isGranted = isPostNotifGranted,
                isRequired = false,
                onRequest = {
                    notifLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
            )
        }

        Spacer(modifier = Modifier.height(16.dp))
    }
}

@Composable
private fun PermissionCard(
    icon: ImageVector,
    title: String,
    description: String,
    isGranted: Boolean,
    isRequired: Boolean,
    onRequest: () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        color = if (isGranted) TwsMint.copy(alpha = 0.2f) else TwsGlassWhite,
        border = BorderStroke(
            1.dp,
            when {
                isGranted -> TwsMint.copy(alpha = 0.5f)
                isRequired -> TwsCoral.copy(alpha = 0.5f)
                else -> TwsGlassBorderLight
            }
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(
                        when {
                            isGranted -> TwsMint.copy(alpha = 0.2f)
                            isRequired -> TwsCoral.copy(alpha = 0.15f)
                            else -> TwsSkyBlue.copy(alpha = 0.15f)
                        }
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = if (isGranted) Icons.Default.CheckCircle else icon,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                    tint = when {
                        isGranted -> TwsMint
                        isRequired -> TwsCoral
                        else -> TwsSkyBlue
                    }
                )
            }

            Spacer(modifier = Modifier.width(14.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = title,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = TwsSkyBlueDark
                    )
                    if (isRequired && !isGranted) {
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "필수",
                            style = MaterialTheme.typography.labelSmall,
                            color = TwsCoral,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
                Text(
                    text = if (isGranted) "설정 완료" else description,
                    style = MaterialTheme.typography.bodySmall,
                    color = if (isGranted) TwsMint else TwsSkyBlueDark.copy(alpha = 0.7f)
                )
            }

            if (!isGranted) {
                Button(
                    onClick = onRequest,
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isRequired) TwsCoral else TwsSkyBlue
                    )
                ) {
                    Text("설정", style = MaterialTheme.typography.labelMedium, color = TwsWhite)
                }
            }
        }
    }
}

@Composable
private fun ReadyPage() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // 글래스 아이콘 컨테이너
        Surface(
            modifier = Modifier
                .size(100.dp),
            shape = RoundedCornerShape(28.dp),
            color = TwsGlassWhite,
            border = BorderStroke(1.5.dp, TwsMint.copy(alpha = 0.5f))
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier.fillMaxSize()
            ) {
                Icon(
                    imageVector = Icons.Default.Rocket,
                    contentDescription = null,
                    modifier = Modifier.size(48.dp),
                    tint = TwsMint
                )
            }
        }

        Spacer(modifier = Modifier.height(32.dp))

        Text(
            text = "준비 완료!",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = TwsWhite
        )

        Spacer(modifier = Modifier.height(12.dp))

        // 글래스 카드
        Surface(
            modifier = Modifier
                .fillMaxWidth(),
            shape = RoundedCornerShape(20.dp),
            color = TwsGlassWhite,
            border = BorderStroke(1.dp, TwsGlassBorderLight)
        ) {
            Text(
                text = "이제 알림이 도착하면 NotiFlow가 자동으로 수집합니다.\n설정에서 카테고리와 필터를 추가하면\n메시지가 자동으로 분류됩니다.",
                style = MaterialTheme.typography.bodyLarge,
                color = TwsSkyBlueDark.copy(alpha = 0.9f),
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(24.dp)
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        // NotiFlow 브랜딩
        Text(
            text = "NotiFlow",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = TwsWhite
        )
        Text(
            text = "Manage Your Notification Flow",
            style = MaterialTheme.typography.labelSmall,
            color = TwsWhite.copy(alpha = 0.7f)
        )
    }
}

// ========== Permission Check Functions ==========

fun checkNotificationListener(context: Context): Boolean {
    val enabledListeners = Settings.Secure.getString(
        context.contentResolver, "enabled_notification_listeners"
    )
    return enabledListeners?.contains(context.packageName) == true
}

fun checkSmsPermission(context: Context): Boolean {
    return ContextCompat.checkSelfPermission(
        context, Manifest.permission.RECEIVE_SMS
    ) == PackageManager.PERMISSION_GRANTED &&
        ContextCompat.checkSelfPermission(
            context, Manifest.permission.READ_SMS
        ) == PackageManager.PERMISSION_GRANTED
}

fun checkPostNotifPermission(context: Context): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        ContextCompat.checkSelfPermission(
            context, Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED
    } else true
}

fun checkBatteryOptimization(context: Context): Boolean {
    val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    return powerManager.isIgnoringBatteryOptimizations(context.packageName)
}
