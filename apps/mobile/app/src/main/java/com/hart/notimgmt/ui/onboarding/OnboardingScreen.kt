package com.hart.notimgmt.ui.onboarding

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BatteryFull
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import com.airbnb.lottie.compose.LottieAnimation
import com.airbnb.lottie.compose.LottieCompositionSpec
import com.airbnb.lottie.compose.rememberLottieComposition
import com.airbnb.lottie.compose.animateLottieCompositionAsState
import com.hart.notimgmt.R
import kotlinx.coroutines.launch

// Unified onboarding color tokens
private val WarmCream = Color(0xFFFFF8F3)
private val SakuraPink = Color(0xFFE8729D)
private val SakuraPinkDark = Color(0xFFD4608A)
private val TextDark = Color(0xFF2D2D2D)
private val TextMuted = Color(0xFF8E8E93)
private val SurfaceLight = Color(0xFFF5F0EB)

@Composable
fun OnboardingScreen(onComplete: () -> Unit) {
    val pagerState = rememberPagerState(pageCount = { 3 })
    val coroutineScope = rememberCoroutineScope()
    val context = LocalContext.current

    var allRequiredPermissionsGranted by remember { mutableStateOf(false) }
    val lifecycleOwner = LocalLifecycleOwner.current

    LaunchedEffect(lifecycleOwner) {
        lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            allRequiredPermissionsGranted = checkNotificationListener(context)
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WarmCream)
    ) {
        Column(
            modifier = Modifier.fillMaxSize()
        ) {
            // Top Section (Skip Button)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 24.dp),
                horizontalArrangement = Arrangement.End
            ) {
                if (pagerState.currentPage < 2) {
                    TextButton(onClick = {
                        coroutineScope.launch { pagerState.animateScrollToPage(2) }
                    }) {
                        Text("건너뛰기", color = TextMuted)
                    }
                } else {
                    Spacer(modifier = Modifier.height(48.dp))
                }
            }

            // Pager Content
            HorizontalPager(
                state = pagerState,
                modifier = Modifier.weight(1f),
                userScrollEnabled = pagerState.currentPage != 2
            ) { page ->
                when (page) {
                    0 -> LottiePage(
                        lottieRes = R.raw.tutorial_timeline,
                        title = "알림을 스마트하게 관리하세요",
                        description = "카카오톡, SMS 등의 주문 알림을 자동으로 분류하고 시간순으로 정리합니다"
                    )
                    1 -> LottiePage(
                        lottieRes = R.raw.tutorial_ai,
                        title = "AI 분류와 칸반 보드",
                        description = "AI가 투석 용품 주문을 자동 분류하고, 칸반 보드로 처리 상태를 한눈에 관리하세요"
                    )
                    2 -> PermissionPage()
                }
            }

            // Bottom Section (Indicators & Button)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 32.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Indicators
                Row(
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    repeat(3) { index ->
                        val color by animateColorAsState(
                            targetValue = if (index == pagerState.currentPage) SakuraPink else Color(0xFFE5DDD7),
                            label = "dot"
                        )
                        Box(
                            modifier = Modifier
                                .height(8.dp)
                                .width(if (index == pagerState.currentPage) 24.dp else 8.dp)
                                .clip(RoundedCornerShape(4.dp))
                                .background(color)
                        )
                        if (index < 2) Spacer(modifier = Modifier.width(8.dp))
                    }
                }

                Spacer(modifier = Modifier.height(32.dp))

                val isLastPage = pagerState.currentPage == 2
                val canProceed = if (isLastPage) allRequiredPermissionsGranted else true

                Button(
                    onClick = {
                        if (!isLastPage) {
                            coroutineScope.launch {
                                pagerState.animateScrollToPage(pagerState.currentPage + 1)
                            }
                        } else if (canProceed) {
                            onComplete()
                        } else {
                            context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = SakuraPink)
                ) {
                    Text(
                        text = when {
                            isLastPage && !canProceed -> "권한 설정하기"
                            isLastPage && canProceed -> "시작하기"
                            else -> "다음"
                        },
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
            }
        }
    }
}

@Composable
private fun LottiePage(lottieRes: Int, title: String, description: String) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Lottie animation in top half
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .padding(top = 8.dp, bottom = 16.dp),
            contentAlignment = Alignment.Center
        ) {
            val composition by rememberLottieComposition(
                LottieCompositionSpec.RawRes(lottieRes)
            )
            val progress by animateLottieCompositionAsState(
                composition,
                iterations = Int.MAX_VALUE
            )
            LottieAnimation(
                composition = composition,
                progress = { progress },
                modifier = Modifier
                    .fillMaxWidth(0.85f)
                    .aspectRatio(1f)
            )
        }

        // Text content below
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(bottom = 16.dp)
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                color = TextDark,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = description,
                style = MaterialTheme.typography.bodyLarge,
                color = TextMuted,
                textAlign = TextAlign.Center,
                lineHeight = MaterialTheme.typography.bodyLarge.lineHeight
            )
        }
    }
}

@Composable
private fun PermissionPage() {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    var isNotifListenerEnabled by remember { mutableStateOf(checkNotificationListener(context)) }
    var isBatterOptDisabled by remember { mutableStateOf(checkBatteryOptimization(context)) }

    LaunchedEffect(lifecycleOwner) {
        lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            isNotifListenerEnabled = checkNotificationListener(context)
            isBatterOptDisabled = checkBatteryOptimization(context)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .size(100.dp)
                .background(SurfaceLight, shape = CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.Shield, contentDescription = null, tint = SakuraPink, modifier = Modifier.size(50.dp))
        }

        Spacer(modifier = Modifier.height(32.dp))

        Text(
            "시작하기 전에",
            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
            color = TextDark
        )
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            "알림을 관리하려면 아래 권한이 필요합니다",
            style = MaterialTheme.typography.bodyMedium,
            color = TextMuted,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            "아래 항목을 탭하여 권한을 허용해 주세요",
            style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Medium),
            color = SakuraPink,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(16.dp))

        PermissionCard(
            icon = Icons.Default.NotificationsActive,
            title = "알림 접근 권한",
            desc = "알림을 읽기 위해 필요합니다 (필수)",
            isGranted = isNotifListenerEnabled,
            onClick = { context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) }
        )

        Spacer(modifier = Modifier.height(16.dp))

        PermissionCard(
            icon = Icons.Default.BatteryFull,
            title = "배터리 최적화 해제",
            desc = "백그라운드 앱 안정성 확보 (선택)",
            isGranted = isBatterOptDisabled,
            onClick = {
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = android.net.Uri.parse("package:${context.packageName}")
                }
                context.startActivity(intent)
            }
        )
    }
}

@Composable
private fun PermissionCard(
    icon: ImageVector,
    title: String,
    desc: String,
    isGranted: Boolean,
    onClick: () -> Unit
) {
    Surface(
        onClick = { if (!isGranted) onClick() },
        shape = RoundedCornerShape(16.dp),
        color = if (isGranted) SakuraPink.copy(alpha = 0.08f) else SurfaceLight,
        border = BorderStroke(
            1.dp,
            if (isGranted) SakuraPink.copy(alpha = 0.3f) else Color(0xFFE5DDD7)
        ),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(20.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = if (isGranted) Icons.Default.CheckCircle else icon,
                contentDescription = null,
                tint = if (isGranted) SakuraPink else TextMuted,
                modifier = Modifier.size(28.dp)
            )
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                    color = if (isGranted) SakuraPinkDark else TextDark
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(text = desc, style = MaterialTheme.typography.bodySmall, color = TextMuted)
            }
        }
    }
}

// ========== Permission Check Functions ==========
fun checkNotificationListener(context: Context): Boolean {
    val enabledListeners = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
    return enabledListeners?.contains(context.packageName) == true
}
fun checkBatteryOptimization(context: Context): Boolean {
    val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    return pm.isIgnoringBatteryOptimizations(context.packageName)
}
fun checkPostNotifPermission(context: Context): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
    } else true
}
fun checkSmsPermission(context: Context): Boolean {
    return ContextCompat.checkSelfPermission(context, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED
}
