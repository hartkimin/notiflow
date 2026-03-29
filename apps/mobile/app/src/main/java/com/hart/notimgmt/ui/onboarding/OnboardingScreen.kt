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
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Insights
import androidx.compose.material.icons.filled.AllInclusive
import androidx.compose.material.icons.filled.BatteryFull
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.ViewKanban
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.launch

// Color tokens based on Stitch Design
private val BrandBlue = Color(0xFF2B2BEE)
private val BrandPurple = Color(0xFF8B5CF6)
private val SurfaceGray = Color(0xFFF9FAFB)
private val TextDark = Color(0xFF111827)
private val TextMuted = Color(0xFF6B7280)
private val GradientBrush = Brush.horizontalGradient(listOf(BrandBlue, BrandPurple))

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
            .background(Color.White)
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
                    0 -> WelcomePage()
                    1 -> FeaturesPage()
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
                            targetValue = if (index == pagerState.currentPage) BrandBlue else Color(0xFFE5E7EB),
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
                        .height(56.dp)
                        .background(
                            brush = GradientBrush,
                            shape = RoundedCornerShape(16.dp)
                        ),
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                    contentPadding = PaddingValues()
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
private fun WelcomePage() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Abstract illustration representation
        Box(
            modifier = Modifier
                .size(160.dp)
                .background(Brush.radialGradient(listOf(BrandPurple.copy(0.15f), Color.Transparent))),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.AllInclusive,
                contentDescription = null,
                modifier = Modifier.size(80.dp),
                tint = BrandBlue
            )
        }

        Spacer(modifier = Modifier.height(48.dp))

        Text(
            text = "NotiFlow에 오신 것을 환영합니다",
            style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.ExtraBold),
            color = TextDark,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "알림을 깔끔하게 관리하세요",
            style = MaterialTheme.typography.bodyLarge,
            color = TextMuted,
            textAlign = TextAlign.Center
        )
    }
}

@Composable
private fun FeaturesPage() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "스마트 알림 관리",
            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
            color = TextDark,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(40.dp))

        FeatureMinimalRow(Icons.Default.AutoAwesome, "AI 자동 분류", "중요한 알림을 자동으로 분류합니다")
        Spacer(modifier = Modifier.height(32.dp))
        FeatureMinimalRow(Icons.Default.ViewKanban, "칸반 보드", "알림을 실행 가능한 작업으로 전환합니다")
        Spacer(modifier = Modifier.height(32.dp))
        FeatureMinimalRow(Icons.Default.Insights, "일일 요약", "놓친 알림을 간결하게 확인하세요")
    }
}

@Composable
private fun FeatureMinimalRow(icon: ImageVector, title: String, desc: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.Top
    ) {
        Box(
            modifier = Modifier
                .size(48.dp)
                .background(SurfaceGray, shape = CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(imageVector = icon, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(24.dp))
        }
        Spacer(modifier = Modifier.width(20.dp))
        Column {
            Text(text = title, style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold), color = TextDark)
            Spacer(modifier = Modifier.height(4.dp))
            Text(text = desc, style = MaterialTheme.typography.bodyMedium, color = TextMuted)
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
                .background(SurfaceGray, shape = CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.Shield, contentDescription = null, tint = BrandPurple, modifier = Modifier.size(50.dp))
        }

        Spacer(modifier = Modifier.height(32.dp))

        Text("권한 설정", style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold), color = TextDark)
        Spacer(modifier = Modifier.height(12.dp))
        Text("알림을 관리하려면 아래 권한이 필요합니다", style = MaterialTheme.typography.bodyMedium, color = TextMuted, textAlign = TextAlign.Center)

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            "아래 항목을 탭하여 권한을 허용해 주세요",
            style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Medium),
            color = BrandPurple,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(16.dp))

        PermissionMinimalCard(
            icon = Icons.Default.NotificationsActive,
            title = "알림 접근 권한",
            desc = "알림을 읽기 위해 필요합니다 (필수)",
            isGranted = isNotifListenerEnabled,
            onClick = { context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) }
        )

        Spacer(modifier = Modifier.height(16.dp))

        PermissionMinimalCard(
            icon = Icons.Default.BatteryFull,
            title = "배터리 최적화 해제",
            desc = "백그라운드 앱 안정성 확보 (선택)",
            isGranted = isBatterOptDisabled,
            onClick = {
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:${context.packageName}")
                }
                context.startActivity(intent)
            }
        )
    }
}

@Composable
private fun PermissionMinimalCard(icon: ImageVector, title: String, desc: String, isGranted: Boolean, onClick: () -> Unit) {
    Surface(
        onClick = { if (!isGranted) onClick() },
        shape = RoundedCornerShape(16.dp),
        color = if (isGranted) BrandBlue.copy(alpha = 0.05f) else SurfaceGray,
        border = BorderStroke(1.dp, if (isGranted) BrandBlue.copy(alpha = 0.3f) else Color(0xFFE5E7EB)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(20.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = if (isGranted) Icons.Default.CheckCircle else icon,
                contentDescription = null,
                tint = if (isGranted) BrandBlue else TextMuted,
                modifier = Modifier.size(28.dp)
            )
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(text = title, style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold), color = if (isGranted) BrandBlue else TextDark)
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
