package com.hart.notimgmt.ui.splash

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ChatBubble
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hart.notimgmt.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun SplashScreen(onFinished: () -> Unit) {
    val alpha = remember { Animatable(0f) }
    val scale = remember { Animatable(0.8f) }
    
    // 미니어처 요소 애니메이션
    val floatAnim = rememberInfiniteTransition(label = "float")
    val offsetY by floatAnim.animateFloat(
        initialValue = -10f,
        targetValue = 10f,
        animationSpec = infiniteRepeatable(
            animation = tween(2000, easing = EaseInOutSine),
            repeatMode = RepeatMode.Reverse
        ), label = "offsetY"
    )

    LaunchedEffect(Unit) {
        launch {
            alpha.animateTo(1f, tween(1000, easing = FastOutSlowInEasing))
        }
        launch {
            scale.animateTo(1f, tween(1000, easing = FastOutSlowInEasing))
        }
        delay(2500)
        onFinished()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                brush = Brush.verticalGradient(
                    colors = listOf(Color(0xFFF0F4F8), Color(0xFFD9E2EC)) // 깔끔한 스튜디오 그레이/블루
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        // 틸트시프트 효과 (상단/하단 블러로 미니어처 느낌 강조)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(150.dp)
                .align(Alignment.TopCenter)
                .blur(20.dp)
                .background(Color.White.copy(alpha = 0.3f))
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(150.dp)
                .align(Alignment.BottomCenter)
                .blur(20.dp)
                .background(Color.White.copy(alpha = 0.3f))
        )

        // 메인 미니어처 스테이지
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .alpha(alpha.value)
                .scale(scale.value)
                .offset(y = offsetY.dp)
        ) {
            // 3D 느낌의 아이콘 흐름 시각화
            Box(
                modifier = Modifier
                    .size(240.dp),
                contentAlignment = Alignment.Center
            ) {
                // 그림자 (바닥면)
                Box(
                    modifier = Modifier
                        .size(160.dp, 40.dp)
                        .offset(y = 100.dp)
                        .blur(15.dp)
                        .background(Color.Black.copy(alpha = 0.1f), CircleShape)
                )

                // 중심 플랫폼 (Nanobanana 스타일의 둥근 입체감)
                Box(
                    modifier = Modifier
                        .size(140.dp)
                        .graphicsLayer {
                            rotationX = 45f
                            rotationZ = -45f
                        }
                        .shadow(
                            elevation = 20.dp,
                            shape = RoundedCornerShape(40.dp),
                            clip = false,
                            ambientColor = Color(0xFF334E68),
                            spotColor = Color(0xFF334E68)
                        )
                        .background(
                            brush = Brush.linearGradient(
                                colors = listOf(Color(0xFF627D98), Color(0xFF334E68))
                            ),
                            shape = RoundedCornerShape(40.dp)
                        )
                        .border(1.dp, Color.White.copy(alpha = 0.2f), RoundedCornerShape(40.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Notifications,
                        contentDescription = null,
                        modifier = Modifier
                            .size(70.dp)
                            .rotate(45f),
                        tint = Color.White
                    )
                }

                // 주변을 떠다니는 미니어처 알림 버블들 (Veo 3.0 스타일)
                NotificationBubble(
                    icon = Icons.Rounded.ChatBubble,
                    color = Color(0xFFFF6B6B),
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .offset(x = (-20).dp, y = 20.dp),
                    delay = 0
                )
                NotificationBubble(
                    icon = Icons.Rounded.Schedule,
                    color = Color(0xFF48BB78),
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .offset(x = 20.dp, y = (-20).dp),
                    delay = 500
                )
                NotificationBubble(
                    icon = Icons.Rounded.Notifications,
                    color = Color(0xFF4299E1),
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .offset(x = 40.dp, y = 40.dp),
                    delay = 1000
                )
            }

            Spacer(modifier = Modifier.height(40.dp))

            // 타이포그래피
            Text(
                text = "NotiFlow",
                style = MaterialTheme.typography.displaySmall.copy(
                    letterSpacing = (-0.5).sp,
                    fontWeight = FontWeight.Black
                ),
                color = Color(0xFF102A43)
            )
            
            Text(
                text = "MINIATURE FLOW ENGINE",
                style = MaterialTheme.typography.labelMedium.copy(
                    letterSpacing = 4.sp,
                    fontWeight = FontWeight.Bold
                ),
                color = Color(0xFF627D98).copy(alpha = 0.8f),
                modifier = Modifier.padding(top = 8.dp)
            )
        }

        // 하단 브랜딩
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 48.dp)
                .alpha(alpha.value)
        ) {
            Text(
                text = "VEO 3.0 DESIGN SYSTEM",
                style = MaterialTheme.typography.labelSmall,
                color = Color(0xFF9FB3C8),
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
fun NotificationBubble(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    color: Color,
    modifier: Modifier = Modifier,
    delay: Int = 0
) {
    val infiniteTransition = rememberInfiniteTransition(label = "bubble")
    val bounce by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 15f,
        animationSpec = infiniteRepeatable(
            animation = tween(1500, delayMillis = delay, easing = EaseInOutQuad),
            repeatMode = RepeatMode.Reverse
        ), label = "bounce"
    )

    Box(
        modifier = modifier
            .offset(y = bounce.dp)
            .size(50.dp)
            .shadow(
                elevation = 12.dp,
                shape = RoundedCornerShape(16.dp),
                ambientColor = color.copy(alpha = 0.4f),
                spotColor = color.copy(alpha = 0.4f)
            )
            .background(color, RoundedCornerShape(16.dp))
            .border(1.dp, Color.White.copy(alpha = 0.3f), RoundedCornerShape(16.dp)),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(24.dp),
            tint = Color.White
        )
    }
}
