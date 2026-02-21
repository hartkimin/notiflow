package com.hart.notimgmt.ui.splash

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Email
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.Send
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun SplashScreen(onFinished: () -> Unit) {
    // ── Entrance animations ──
    val alpha = remember { Animatable(0f) }
    val scale = remember { Animatable(0.85f) }

    // ── Infinite animations ──
    val inf = rememberInfiniteTransition(label = "splash")

    // Central icon gentle float
    val floatY by inf.animateFloat(
        initialValue = -10f, targetValue = 10f,
        animationSpec = infiniteRepeatable(
            tween(3000, easing = EaseInOutSine), RepeatMode.Reverse
        ), label = "floatY"
    )

    // Pulse ring 1
    val pulse1Scale by inf.animateFloat(
        initialValue = 1f, targetValue = 2.5f,
        animationSpec = infiniteRepeatable(
            tween(2500, easing = LinearOutSlowInEasing), RepeatMode.Restart
        ), label = "p1s"
    )
    val pulse1Alpha by inf.animateFloat(
        initialValue = 0.5f, targetValue = 0f,
        animationSpec = infiniteRepeatable(
            tween(2500, easing = LinearOutSlowInEasing), RepeatMode.Restart
        ), label = "p1a"
    )

    // Pulse ring 2 (staggered by half)
    val pulse2Scale by inf.animateFloat(
        initialValue = 1f, targetValue = 2.5f,
        animationSpec = infiniteRepeatable(
            tween(2500, delayMillis = 1250, easing = LinearOutSlowInEasing), RepeatMode.Restart
        ), label = "p2s"
    )
    val pulse2Alpha by inf.animateFloat(
        initialValue = 0.5f, targetValue = 0f,
        animationSpec = infiniteRepeatable(
            tween(2500, delayMillis = 1250, easing = LinearOutSlowInEasing), RepeatMode.Restart
        ), label = "p2a"
    )

    // Orbital flow arcs — slow rotation
    val orbitAngle by inf.animateFloat(
        initialValue = 0f, targetValue = 360f,
        animationSpec = infiniteRepeatable(
            tween(10000, easing = LinearEasing), RepeatMode.Restart
        ), label = "orbit"
    )

    LaunchedEffect(Unit) {
        launch { alpha.animateTo(1f, tween(1000, easing = FastOutSlowInEasing)) }
        launch { scale.animateTo(1f, tween(1200, easing = FastOutSlowInEasing)) }
        delay(2500)
        onFinished()
    }

    // ── Background ──
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        Color(0xFF0F172A),
                        Color(0xFF1E293B),
                        Color(0xFF0F172A)
                    )
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        // Subtle radial glow behind everything
        Box(
            modifier = Modifier
                .size(480.dp)
                .alpha(0.25f)
                .background(
                    Brush.radialGradient(
                        colors = listOf(Color(0xFF3B82F6), Color.Transparent)
                    )
                )
        )

        // ── Main content ──
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .alpha(alpha.value)
                .scale(scale.value)
        ) {
            // Icon + bubbles area
            Box(
                modifier = Modifier.size(280.dp),
                contentAlignment = Alignment.Center
            ) {
                // ── Orbital flow arcs ──
                Box(
                    modifier = Modifier
                        .size(220.dp)
                        .graphicsLayer { rotationZ = orbitAngle }
                        .drawBehind {
                            val strokeWidth = 1.5.dp.toPx()
                            val arcPad = strokeWidth / 2
                            val arcSize = Size(size.width - strokeWidth, size.height - strokeWidth)
                            val arcOffset = Offset(arcPad, arcPad)
                            drawArc(
                                color = Color(0xFF60A5FA).copy(alpha = 0.4f),
                                startAngle = 0f,
                                sweepAngle = 90f,
                                useCenter = false,
                                topLeft = arcOffset,
                                size = arcSize,
                                style = Stroke(strokeWidth, cap = StrokeCap.Round)
                            )
                            drawArc(
                                color = Color(0xFF818CF8).copy(alpha = 0.35f),
                                startAngle = 150f,
                                sweepAngle = 70f,
                                useCenter = false,
                                topLeft = arcOffset,
                                size = arcSize,
                                style = Stroke(strokeWidth, cap = StrokeCap.Round)
                            )
                        }
                )
                // Second orbit ring (counter-rotate, smaller)
                Box(
                    modifier = Modifier
                        .size(170.dp)
                        .graphicsLayer { rotationZ = -orbitAngle * 0.7f }
                        .drawBehind {
                            val sw = 1.dp.toPx()
                            val pad = sw / 2
                            val aSize = Size(size.width - sw, size.height - sw)
                            drawArc(
                                color = Color(0xFF38BDF8).copy(alpha = 0.3f),
                                startAngle = 60f,
                                sweepAngle = 80f,
                                useCenter = false,
                                topLeft = Offset(pad, pad),
                                size = aSize,
                                style = Stroke(sw, cap = StrokeCap.Round)
                            )
                        }
                )

                // ── Pulse rings ──
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .scale(pulse1Scale)
                        .alpha(pulse1Alpha)
                        .border(1.5.dp, Color(0xFF3B82F6), CircleShape)
                )
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .scale(pulse2Scale)
                        .alpha(pulse2Alpha)
                        .border(1.5.dp, Color(0xFF3B82F6), CircleShape)
                )

                // ── Notification bubbles ──
                NotificationBubble(
                    icon = Icons.Rounded.Email,
                    color = Color(0xFFF43F5E),
                    modifier = Modifier.align(Alignment.TopEnd).offset(x = (-10).dp, y = 20.dp),
                    delayMs = 0
                )
                NotificationBubble(
                    icon = Icons.Rounded.Star,
                    color = Color(0xFF3B82F6),
                    modifier = Modifier.align(Alignment.CenterStart).offset(x = 8.dp, y = (-15).dp),
                    delayMs = 400
                )
                NotificationBubble(
                    icon = Icons.Rounded.Schedule,
                    color = Color(0xFF10B981),
                    modifier = Modifier.align(Alignment.BottomStart).offset(x = 25.dp, y = (-25).dp),
                    delayMs = 800
                )
                NotificationBubble(
                    icon = Icons.Rounded.Notifications,
                    color = Color(0xFFF59E0B),
                    modifier = Modifier.align(Alignment.TopStart).offset(x = 30.dp, y = 50.dp),
                    delayMs = 200
                )
                NotificationBubble(
                    icon = Icons.Rounded.Send,
                    color = Color(0xFF8B5CF6),
                    modifier = Modifier.align(Alignment.BottomEnd).offset(x = (-20).dp, y = (-40).dp),
                    delayMs = 600
                )

                // ── Central icon ──
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .offset(y = floatY.dp)
                        .graphicsLayer {
                            shadowElevation = 24.dp.toPx()
                            shape = CircleShape
                            clip = false
                            ambientShadowColor = Color(0xFF3B82F6).copy(alpha = 0.4f)
                            spotShadowColor = Color(0xFF3B82F6).copy(alpha = 0.6f)
                        }
                        .background(
                            Brush.linearGradient(
                                colors = listOf(Color(0xFF3B82F6), Color(0xFF6366F1)),
                                start = Offset(0f, 0f),
                                end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY)
                            ),
                            CircleShape
                        )
                        .border(
                            width = 2.dp,
                            brush = Brush.linearGradient(
                                colors = listOf(
                                    Color.White.copy(alpha = 0.5f),
                                    Color.Transparent,
                                    Color.White.copy(alpha = 0.15f)
                                )
                            ),
                            shape = CircleShape
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Notifications,
                        contentDescription = null,
                        modifier = Modifier.size(40.dp),
                        tint = Color.White
                    )
                }
            }

            Spacer(modifier = Modifier.height(40.dp))

            // ── Typography ──
            Text(
                text = "NotiFlow",
                style = MaterialTheme.typography.displayMedium.copy(
                    letterSpacing = (-1).sp,
                    fontWeight = FontWeight.ExtraBold
                ),
                color = Color.White
            )
            Text(
                text = "모든 알림, 하나의 흐름으로",
                style = MaterialTheme.typography.bodyMedium.copy(
                    letterSpacing = 2.sp,
                    fontWeight = FontWeight.Medium
                ),
                color = Color(0xFF94A3B8),
                modifier = Modifier.padding(top = 8.dp)
            )
        }
    }
}

// ── Floating notification bubble ────────────────────────────────────────────

@Composable
private fun NotificationBubble(
    icon: ImageVector,
    color: Color,
    modifier: Modifier = Modifier,
    delayMs: Int = 0
) {
    val inf = rememberInfiniteTransition(label = "bubble_$delayMs")
    val bounce by inf.animateFloat(
        initialValue = 0f,
        targetValue = 14f,
        animationSpec = infiniteRepeatable(
            tween(2000, delayMillis = delayMs, easing = EaseInOutSine),
            RepeatMode.Reverse
        ), label = "bounce"
    )

    Box(
        modifier = modifier
            .offset(y = bounce.dp)
            .size(48.dp)
            .graphicsLayer {
                shadowElevation = 12.dp.toPx()
                shape = CircleShape
                clip = false
                ambientShadowColor = color.copy(alpha = 0.4f)
                spotShadowColor = color.copy(alpha = 0.6f)
            }
            .background(
                brush = Brush.radialGradient(
                    colors = listOf(color.copy(alpha = 0.85f), color),
                    center = Offset(18f, 18f),
                    radius = 70f
                ),
                shape = CircleShape
            )
            .border(
                width = 1.5.dp,
                brush = Brush.linearGradient(
                    colors = listOf(Color.White.copy(alpha = 0.7f), Color.Transparent),
                    start = Offset(0f, 0f),
                    end = Offset(80f, 80f)
                ),
                shape = CircleShape
            ),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(22.dp),
            tint = Color.White
        )
    }
}
