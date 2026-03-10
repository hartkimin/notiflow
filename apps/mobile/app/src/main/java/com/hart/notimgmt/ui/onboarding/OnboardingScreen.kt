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
import androidx.compose.foundation.Canvas
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
import androidx.compose.material.icons.filled.BatteryFull
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Insights
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.ViewKanban
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import com.hart.notimgmt.ui.theme.NotiFlowIndigo
import com.hart.notimgmt.ui.theme.NotiFlowIndigoLight
import com.hart.notimgmt.ui.theme.NotiFlowViolet
import com.hart.notimgmt.ui.theme.NotiFlowVioletLight
import kotlinx.coroutines.launch
import kotlin.math.cos
import kotlin.math.sin

// Anime Kawaii color tokens
private val Sakura = NotiFlowIndigo
private val SakuraLight = NotiFlowIndigoLight
private val Lavender = NotiFlowViolet
private val LavenderLight = NotiFlowVioletLight
private val BgCream = Color(0xFFFFF8F3)
private val SurfacePink = Color(0xFFFFF0F5)
private val TextDark = Color(0xFF2D1B33)
private val TextMuted = Color(0xFF7B6B80)
private val GradientBrush = Brush.horizontalGradient(listOf(Sakura, Lavender))

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
            .background(BgCream)
    ) {
        // Subtle sparkle background
        Canvas(modifier = Modifier.fillMaxSize().alpha(0.5f)) {
            val w = size.width
            val h = size.height
            // Soft glow orbs
            drawCircle(
                brush = Brush.radialGradient(
                    listOf(SakuraLight.copy(alpha = 0.12f), Color.Transparent),
                    center = Offset(w * 0.1f, h * 0.15f), radius = w * 0.3f
                )
            )
            drawCircle(
                brush = Brush.radialGradient(
                    listOf(LavenderLight.copy(alpha = 0.1f), Color.Transparent),
                    center = Offset(w * 0.9f, h * 0.85f), radius = w * 0.35f
                )
            )
            // Mini sparkle stars
            val sparkles = listOf(
                Triple(0.9f, 0.08f, 5f), Triple(0.05f, 0.45f, 4f),
                Triple(0.85f, 0.5f, 3f), Triple(0.15f, 0.88f, 5f),
                Triple(0.7f, 0.92f, 4f)
            )
            sparkles.forEachIndexed { i, (fx, fy, r) ->
                val color = if (i % 2 == 0) SakuraLight else LavenderLight
                drawStar(Offset(w * fx, h * fy), r * (w / 400f), color.copy(alpha = 0.4f))
            }
        }

        Column(modifier = Modifier.fillMaxSize()) {
            // Top Section (Skip)
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
                // Dot indicators
                Row(
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    repeat(3) { index ->
                        val color by animateColorAsState(
                            targetValue = if (index == pagerState.currentPage) Sakura else Color(0xFFE8D5E0),
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
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp)
                        .background(
                            brush = if (canProceed) GradientBrush
                            else Brush.horizontalGradient(listOf(Color(0xFFD4C4CC), Color(0xFFD4C4CC))),
                            shape = RoundedCornerShape(16.dp)
                        ),
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                    contentPadding = PaddingValues()
                ) {
                    Text(
                        text = when {
                            isLastPage && !canProceed -> "권한을 허용해 주세요"
                            isLastPage && canProceed -> "시작하기!"
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
        // Kawaii icon with soft glow
        Box(
            modifier = Modifier
                .size(160.dp)
                .background(
                    Brush.radialGradient(listOf(SakuraLight.copy(0.2f), Color.Transparent)),
                    shape = CircleShape
                ),
            contentAlignment = Alignment.Center
        ) {
            Box(
                modifier = Modifier
                    .size(100.dp)
                    .background(
                        Brush.linearGradient(listOf(SakuraLight.copy(0.3f), LavenderLight.copy(0.2f))),
                        shape = CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text("N", style = MaterialTheme.typography.displayLarge.copy(fontWeight = FontWeight.ExtraBold), color = Sakura)
            }
        }

        Spacer(modifier = Modifier.height(48.dp))

        Text(
            text = "NotiFlow\uc5d0 \uc624\uc2e0 \uac83\uc744 \ud658\uc601\ud574\uc694!",
            style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.ExtraBold),
            color = TextDark,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "\uc54c\ub9bc\uc744 \uae54\ub054\ud558\uac8c \uc815\ub9ac\ud558\uace0\n\ud558\ub8e8\ub97c \uac00\ubccd\uac8c \uc2dc\uc791\ud574 \ubcf4\uc138\uc694",
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
            text = "\ub611\ub611\ud55c \uae30\ub2a5\ub4e4",
            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
            color = TextDark,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(40.dp))

        FeatureMinimalRow(Icons.Default.AutoAwesome, "AI \uc790\ub3d9 \ubd84\ub958", "\uc911\uc694\ud55c \uc54c\ub9bc\uc744 \uc790\ub3d9\uc73c\ub85c \uce74\ud14c\uace0\ub9ac \ubd84\ub958")
        Spacer(modifier = Modifier.height(32.dp))
        FeatureMinimalRow(Icons.Default.ViewKanban, "\uce78\ubc18 \ubcf4\ub4dc", "\uc54c\ub9bc\uc744 \uc791\uc5c5 \uce74\ub4dc\ub85c \ubcc0\ud658\ud574 \uad00\ub9ac")
        Spacer(modifier = Modifier.height(32.dp))
        FeatureMinimalRow(Icons.Default.Insights, "\ud558\ub8e8 \uc694\uc57d", "\ub193\uce5c \uc54c\ub9bc\ub3c4 \ud55c\ub208\uc5d0 \ud655\uc778")
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
                .background(SurfacePink, shape = CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(imageVector = icon, contentDescription = null, tint = Sakura, modifier = Modifier.size(24.dp))
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
                .background(SurfacePink, shape = CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.Shield, contentDescription = null, tint = Lavender, modifier = Modifier.size(50.dp))
        }

        Spacer(modifier = Modifier.height(32.dp))

        Text("\uad8c\ud55c \uc124\uc815", style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold), color = TextDark)
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            "\uc54c\ub9bc\uc744 \uc815\ub9ac\ud558\ub824\uba74 \uc544\ub798 \uad8c\ud55c\uc774 \ud544\uc694\ud574\uc694",
            style = MaterialTheme.typography.bodyMedium, color = TextMuted, textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(40.dp))

        PermissionMinimalCard(
            icon = Icons.Default.NotificationsActive,
            title = "\uc54c\ub9bc \uc811\uadfc \uad8c\ud55c",
            desc = "\uc218\uc2e0\ub418\ub294 \uc54c\ub9bc\uc744 \uc77d\uae30 \uc704\ud574 \ud544\uc218",
            isGranted = isNotifListenerEnabled,
            onClick = { context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) }
        )

        Spacer(modifier = Modifier.height(16.dp))

        PermissionMinimalCard(
            icon = Icons.Default.BatteryFull,
            title = "\ubc30\ud130\ub9ac \ucd5c\uc801\ud654 \ud574\uc81c",
            desc = "\ubc31\uadf8\ub77c\uc6b4\ub4dc \uc2e4\ud589 \uc548\uc815\uc131 \ud655\ubcf4 (\uc120\ud0dd)",
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
        color = if (isGranted) Sakura.copy(alpha = 0.06f) else SurfacePink,
        border = BorderStroke(1.dp, if (isGranted) Sakura.copy(alpha = 0.3f) else Color(0xFFE8D5E0)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(20.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = if (isGranted) Icons.Default.CheckCircle else icon,
                contentDescription = null,
                tint = if (isGranted) Sakura else TextMuted,
                modifier = Modifier.size(28.dp)
            )
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                    color = if (isGranted) Sakura else TextDark
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(text = desc, style = MaterialTheme.typography.bodySmall, color = TextMuted)
            }
        }
    }
}

/** Draw a 4-pointed sparkle star */
private fun DrawScope.drawStar(center: Offset, radius: Float, color: Color) {
    val path = Path().apply {
        for (i in 0 until 4) {
            val angle = Math.toRadians((i * 90.0) - 90.0)
            val x = center.x + radius * cos(angle).toFloat()
            val y = center.y + radius * sin(angle).toFloat()
            if (i == 0) moveTo(x, y) else lineTo(x, y)
            val midAngle = Math.toRadians((i * 90.0 + 45.0) - 90.0)
            val mx = center.x + radius * 0.35f * cos(midAngle).toFloat()
            val my = center.y + radius * 0.35f * sin(midAngle).toFloat()
            lineTo(mx, my)
        }
        close()
    }
    drawPath(path, color)
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
