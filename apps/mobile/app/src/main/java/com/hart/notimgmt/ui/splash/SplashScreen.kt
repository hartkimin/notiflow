package com.hart.notimgmt.ui.splash

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.BlurOn
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

@Composable
fun SplashScreen(onFinished: () -> Unit) {
    val alpha = remember { Animatable(0f) }
    val scale = remember { Animatable(0.9f) }
    
    // 오로라 애니메이션 값
    val auroraPhase1 = remember { Animatable(0f) }
    val auroraPhase2 = remember { Animatable(PI.toFloat()) }
    val auroraPhase3 = remember { Animatable(PI.toFloat() / 2f) }

    LaunchedEffect(Unit) {
        // 페이드인 + 스케일업
        launch {
            alpha.animateTo(
                targetValue = 1f,
                animationSpec = tween(1000, easing = FastOutSlowInEasing)
            )
        }
        launch {
            scale.animateTo(
                targetValue = 1f,
                animationSpec = tween(1000, easing = FastOutSlowInEasing)
            )
        }
        
        // 배경 오로라 무한 애니메이션
        launch {
            while (true) {
                auroraPhase1.animateTo(
                    targetValue = auroraPhase1.value + (PI.toFloat() * 2f),
                    animationSpec = tween(15000, easing = androidx.compose.animation.core.LinearEasing)
                )
            }
        }
        launch {
            while (true) {
                auroraPhase2.animateTo(
                    targetValue = auroraPhase2.value + (PI.toFloat() * 2f),
                    animationSpec = tween(20000, easing = androidx.compose.animation.core.LinearEasing)
                )
            }
        }
        launch {
            while (true) {
                auroraPhase3.animateTo(
                    targetValue = auroraPhase3.value + (PI.toFloat() * 2f),
                    animationSpec = tween(18000, easing = androidx.compose.animation.core.LinearEasing)
                )
            }
        }
        
        delay(2000)
        onFinished()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0D1117)) // 깊은 다크 배경
    ) {
        // 동적 오로라 그라데이션 배경 (세련된 블러 효과)
        Box(modifier = Modifier.fillMaxSize()) {
            // 오브젝트 1: Soft Blue
            Box(
                modifier = Modifier
                    .offset(
                        x = (cos(auroraPhase1.value) * 100).dp,
                        y = (sin(auroraPhase1.value) * 150 - 100).dp
                    )
                    .size(400.dp)
                    .align(Alignment.TopStart)
                    .alpha(0.6f)
                    .blur(100.dp)
                    .background(Color(0xFF3B82F6).copy(alpha = 0.4f), CircleShape)
            )
            
            // 오브젝트 2: Vibrant Purple/Pink
            Box(
                modifier = Modifier
                    .offset(
                        x = (sin(auroraPhase2.value) * 120).dp,
                        y = (cos(auroraPhase2.value) * 120 + 50).dp
                    )
                    .size(350.dp)
                    .align(Alignment.CenterEnd)
                    .alpha(0.5f)
                    .blur(120.dp)
                    .background(Color(0xFF8B5CF6).copy(alpha = 0.5f), CircleShape)
            )
            
            // 오브젝트 3: Teal/Mint
            Box(
                modifier = Modifier
                    .offset(
                        x = (cos(auroraPhase3.value) * 150).dp,
                        y = (sin(auroraPhase3.value) * 80 + 100).dp
                    )
                    .size(450.dp)
                    .align(Alignment.BottomStart)
                    .alpha(0.4f)
                    .blur(130.dp)
                    .background(Color(0xFF10B981).copy(alpha = 0.3f), CircleShape)
            )
            
            // 전역 노이즈 텍스처 오버레이 (옵션, 고급스러운 매트 느낌)
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.1f))
            )
        }

        // 중앙 콘텐츠
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .align(Alignment.Center)
                .alpha(alpha.value)
                .scale(scale.value)
        ) {
            // 모던 글래스모피즘 아이콘 로고
            Box(
                modifier = Modifier
                    .size(110.dp)
                    .clip(RoundedCornerShape(32.dp))
                    .background(
                        Brush.linearGradient(
                            colors = listOf(
                                Color.White.copy(alpha = 0.2f),
                                Color.White.copy(alpha = 0.05f)
                            ),
                            start = Offset(0f, 0f),
                            end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY)
                        )
                    )
                    .border(
                        width = 1.dp,
                        brush = Brush.linearGradient(
                            colors = listOf(
                                Color.White.copy(alpha = 0.5f),
                                Color.Transparent,
                                Color.White.copy(alpha = 0.1f)
                            )
                        ),
                        shape = RoundedCornerShape(32.dp)
                    ),
                contentAlignment = Alignment.Center
            ) {
                // 내부 아이콘 그라데이션 적용
                Icon(
                    imageVector = Icons.Rounded.BlurOn,
                    contentDescription = null,
                    modifier = Modifier.size(56.dp),
                    tint = Color.White
                )
            }

            Spacer(modifier = Modifier.height(32.dp))

            // 앱 이름
            Text(
                text = "NotiFlow",
                style = MaterialTheme.typography.displayMedium.copy(
                    letterSpacing = (-1).sp
                ),
                fontWeight = FontWeight.ExtraBold,
                color = Color.White
            )

            Spacer(modifier = Modifier.height(12.dp))

            // 세련된 서브타이틀 캡슐
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(100.dp))
                    .background(Color.White.copy(alpha = 0.1f))
                    .padding(horizontal = 20.dp, vertical = 8.dp)
            ) {
                Text(
                    text = "Sync Your Digital Life",
                    style = MaterialTheme.typography.bodyMedium.copy(
                        letterSpacing = 1.5.sp
                    ),
                    fontWeight = FontWeight.Medium,
                    color = Color.White.copy(alpha = 0.8f)
                )
            }
        }

        // 하단 미니멀 로딩 인디케이터
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 48.dp)
                .alpha(alpha.value)
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                repeat(3) { index ->
                    val dotScale = remember { Animatable(0.5f) }
                    val dotOpacity = remember { Animatable(0.2f) }
                    
                    LaunchedEffect(Unit) {
                        delay(index * 200L)
                        while (true) {
                            launch { dotScale.animateTo(1f, tween(600, easing = FastOutSlowInEasing)) }
                            launch { dotOpacity.animateTo(1f, tween(600, easing = FastOutSlowInEasing)) }
                            delay(600)
                            launch { dotScale.animateTo(0.5f, tween(600, easing = FastOutSlowInEasing)) }
                            launch { dotOpacity.animateTo(0.2f, tween(600, easing = FastOutSlowInEasing)) }
                            delay(600)
                        }
                    }
                    
                    Box(
                        modifier = Modifier
                            .size(6.dp)
                            .scale(dotScale.value)
                            .alpha(dotOpacity.value)
                            .background(Color.White, CircleShape)
                    )
                }
            }
        }
    }
}
