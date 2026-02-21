package com.hart.notimgmt.ui.splash

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Email
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun SplashScreen(onFinished: () -> Unit) {
    val alpha = remember { Animatable(0f) }
    val scale = remember { Animatable(0.8f) }
    
    // 미니어처 둥둥 떠다니는 애니메이션
    val floatAnim = rememberInfiniteTransition(label = "float")
    val offsetY by floatAnim.animateFloat(
        initialValue = -15f,
        targetValue = 15f,
        animationSpec = infiniteRepeatable(
            animation = tween(2500, easing = EaseInOutSine),
            repeatMode = RepeatMode.Reverse
        ), label = "offsetY"
    )

    LaunchedEffect(Unit) {
        launch { alpha.animateTo(1f, tween(1200, easing = FastOutSlowInEasing)) }
        launch { scale.animateTo(1f, tween(1200, easing = FastOutSlowInEasing)) }
        delay(2500)
        onFinished()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            // 스튜디오 환경의 부드러운 스포트라이트 조명
            .background(
                Brush.radialGradient(
                    colors = listOf(
                        Color(0xFFE2E8F0), // 밝은 조명 중심
                        Color(0xFF94A3B8), // 중간 회색
                        Color(0xFF475569)  // 어두운 배경 가장자리
                    ),
                    center = Offset(500f, 800f),
                    radius = 1800f
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        // --- 틸트-시프트 (미니어처 렌즈 효과) 필터 ---
        // 상단 아웃포커싱
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.3f)
                .align(Alignment.TopCenter)
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color.White.copy(alpha = 0.4f), Color.Transparent)
                    )
                )
                .blur(25.dp)
        )
        // 하단 아웃포커싱
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.3f)
                .align(Alignment.BottomCenter)
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.2f))
                    )
                )
                .blur(25.dp)
        )

        // 메인 3D 오브젝트 컨테이너
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .alpha(alpha.value)
                .scale(scale.value)
                .offset(y = offsetY.dp)
        ) {
            Box(
                modifier = Modifier.size(280.dp),
                contentAlignment = Alignment.Center
            ) {
                // 부드러운 스튜디오 그림자
                Canvas(modifier = Modifier.size(200.dp, 60.dp).offset(y = 120.dp).blur(15.dp)) {
                    drawOval(color = Color.Black.copy(alpha = 0.35f))
                }

                // 3D 렌더링된 물리적 재질 느낌의 플랫폼 (Nanobanana 스타일 클레이모피즘)
                Box(
                    modifier = Modifier
                        .size(150.dp)
                        .graphicsLayer {
                            rotationX = 55f
                            rotationZ = -45f
                            cameraDistance = 8 * density
                        }
                        .shadow(
                            elevation = 30.dp,
                            shape = RoundedCornerShape(45.dp),
                            ambientColor = Color(0xFF0F172A),
                            spotColor = Color(0xFF0F172A)
                        )
                        // 재질: 부드러운 무광 플라스틱 / 세라믹
                        .background(
                            brush = Brush.linearGradient(
                                colors = listOf(Color(0xFF38BDF8), Color(0xFF1D4ED8)),
                                start = Offset(0f, 0f),
                                end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY)
                            ),
                            shape = RoundedCornerShape(45.dp)
                        )
                        // 하이라이트 (모서리 반사광)
                        .border(
                            width = 2.dp,
                            brush = Brush.linearGradient(
                                colors = listOf(Color.White.copy(alpha = 0.8f), Color.Transparent, Color.White.copy(alpha = 0.2f))
                            ),
                            shape = RoundedCornerShape(45.dp)
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Notifications,
                        contentDescription = null,
                        modifier = Modifier
                            .size(75.dp)
                            .rotate(45f)
                            .graphicsLayer { rotationX = -10f }, // 아이콘도 살짝 입체감
                        tint = Color.White
                    )
                }

                // 미니어처 캡슐 알림들 (광택 있는 유리/플라스틱 구슬 느낌)
                MiniatureFloatingBubble(
                    icon = Icons.Rounded.Email,
                    color = Color(0xFFF43F5E),
                    modifier = Modifier.align(Alignment.TopEnd).offset(x = (-20).dp, y = 30.dp),
                    delay = 0
                )
                MiniatureFloatingBubble(
                    icon = Icons.Rounded.Schedule,
                    color = Color(0xFF10B981),
                    modifier = Modifier.align(Alignment.BottomStart).offset(x = 30.dp, y = (-30).dp),
                    delay = 600
                )
                MiniatureFloatingBubble(
                    icon = Icons.Rounded.Notifications,
                    color = Color(0xFFF59E0B),
                    modifier = Modifier.align(Alignment.TopStart).offset(x = 40.dp, y = 60.dp),
                    delay = 1200
                )
            }

            Spacer(modifier = Modifier.height(48.dp))

            // 타이포그래피 (현대적이고 묵직한 룩)
            Text(
                text = "NotiFlow",
                style = MaterialTheme.typography.displayMedium.copy(
                    letterSpacing = (-1).sp,
                    fontWeight = FontWeight.ExtraBold
                ),
                color = Color(0xFF0F172A)
            )
            
            Text(
                text = "PHOTOREALISTIC FLOW ENGINE",
                style = MaterialTheme.typography.labelSmall.copy(
                    letterSpacing = 5.sp,
                    fontWeight = FontWeight.Bold
                ),
                color = Color(0xFF475569),
                modifier = Modifier.padding(top = 8.dp)
            )
        }
    }
}

@Composable
fun MiniatureFloatingBubble(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    color: Color,
    modifier: Modifier = Modifier,
    delay: Int = 0
) {
    val infiniteTransition = rememberInfiniteTransition(label = "bubble")
    val bounce by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 20f,
        animationSpec = infiniteRepeatable(
            animation = tween(2000, delayMillis = delay, easing = EaseInOutSine),
            repeatMode = RepeatMode.Reverse
        ), label = "bounce"
    )

    Box(
        modifier = modifier
            .offset(y = bounce.dp)
            .size(56.dp)
            .graphicsLayer {
                cameraDistance = 8 * density
            }
            .shadow(
                elevation = 16.dp,
                shape = CircleShape,
                ambientColor = color.copy(alpha = 0.5f),
                spotColor = color.copy(alpha = 0.7f)
            )
            // 매끄러운 3D 구슬 느낌의 방사형 그라데이션
            .background(
                brush = Brush.radialGradient(
                    colors = listOf(color.copy(alpha = 0.8f), color),
                    center = Offset(20f, 20f),
                    radius = 80f
                ),
                shape = CircleShape
            )
            // 하이라이트 (스포트라이트 반사)
            .border(
                width = 1.5.dp,
                brush = Brush.linearGradient(
                    colors = listOf(Color.White.copy(alpha = 0.9f), Color.Transparent),
                    start = Offset(0f, 0f),
                    end = Offset(100f, 100f)
                ),
                shape = CircleShape
            ),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(26.dp),
            tint = Color.White
        )
    }
}
