package com.hart.notimgmt.ui.splash

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.hart.notimgmt.R
import com.hart.notimgmt.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun SplashScreen(onFinished: () -> Unit) {
    val alpha = remember { Animatable(0f) }
    val scale = remember { Animatable(0.8f) }
    val glassColors = TwsTheme.glassColors

    LaunchedEffect(Unit) {
        // 동시에 페이드인 + 스케일업 애니메이션
        launch {
            alpha.animateTo(
                targetValue = 1f,
                animationSpec = tween(800, easing = FastOutSlowInEasing)
            )
        }
        launch {
            scale.animateTo(
                targetValue = 1f,
                animationSpec = tween(800, easing = FastOutSlowInEasing)
            )
        }
        delay(1500)
        onFinished()
    }

    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        // NotiFlow 배경
        AsyncImage(
            model = ImageRequest.Builder(LocalContext.current)
                .data(R.drawable.notiflow_splash_bg)
                .crossfade(true)
                .build(),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize()
        )

        // 그라데이션 오버레이 (가독성 향상)
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    brush = Brush.verticalGradient(
                        colors = listOf(
                            Color.Black.copy(alpha = 0.15f),
                            Color.Transparent,
                            Color.Black.copy(alpha = 0.2f)
                        )
                    )
                )
        )

        // 콘텐츠
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .alpha(alpha.value)
                .scale(scale.value)
        ) {
            // 글래스 아이콘 컨테이너
            Surface(
                modifier = Modifier
                    .size(120.dp)
                    .shadow(
                        elevation = 24.dp,
                        shape = RoundedCornerShape(32.dp),
                        ambientColor = TwsSkyBlueDark.copy(alpha = 0.5f),
                        spotColor = TwsSkyBlueDark.copy(alpha = 0.5f)
                    ),
                shape = RoundedCornerShape(32.dp),
                color = TwsGlassWhite,
                border = androidx.compose.foundation.BorderStroke(
                    1.5.dp,
                    TwsGlassBorderLight
                )
            ) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.fillMaxSize()
                ) {
                    Icon(
                        imageVector = Icons.Default.Notifications,
                        contentDescription = null,
                        modifier = Modifier.size(56.dp),
                        tint = TwsSkyBlue
                    )
                }
            }

            Spacer(modifier = Modifier.height(32.dp))

            // 앱 이름
            Text(
                text = "NotiFlow",
                style = MaterialTheme.typography.displayMedium,
                fontWeight = FontWeight.Bold,
                color = TwsWhite
            )

            Spacer(modifier = Modifier.height(8.dp))

            // 서브타이틀
            Text(
                text = "알림의 흐름을 관리하세요",
                style = MaterialTheme.typography.bodyLarge,
                color = TwsWhite.copy(alpha = 0.9f)
            )

            Spacer(modifier = Modifier.height(48.dp))

            // TWS 스타일 로딩 인디케이터
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                repeat(3) { index ->
                    val dotAlpha = remember { Animatable(0.3f) }
                    LaunchedEffect(Unit) {
                        delay(index * 150L)
                        while (true) {
                            dotAlpha.animateTo(1f, tween(400))
                            dotAlpha.animateTo(0.3f, tween(400))
                        }
                    }
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .alpha(dotAlpha.value)
                            .background(TwsWhite, CircleShape)
                    )
                }
            }
        }

        // 하단 브랜딩
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 32.dp)
                .alpha(alpha.value)
        ) {
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
}
