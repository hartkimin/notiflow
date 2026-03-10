package com.hart.notimgmt.ui.splash

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hart.notimgmt.ui.theme.NotiFlowIndigo
import com.hart.notimgmt.ui.theme.NotiFlowIndigoLight
import com.hart.notimgmt.ui.theme.NotiFlowViolet
import com.hart.notimgmt.ui.theme.NotiFlowVioletLight
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.cos
import kotlin.math.sin

@Composable
fun SplashScreen(onFinished: () -> Unit) {
    val alphaAnim = remember { Animatable(0f) }
    val scaleAnim = remember { Animatable(0.85f) }
    val sparkleAnim = rememberInfiniteTransition(label = "sparkle")
    val sparklePhase = sparkleAnim.animateFloat(
        initialValue = 0f, targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(6000, easing = LinearEasing)),
        label = "sparkleRotation"
    )

    LaunchedEffect(Unit) {
        launch { alphaAnim.animateTo(1f, tween(1000, easing = EaseOutExpo)) }
        launch { scaleAnim.animateTo(1f, tween(1200, easing = EaseOutBack)) }
        delay(3000)
        onFinished()
    }

    val sakura = NotiFlowIndigo
    val sakuraLight = NotiFlowIndigoLight
    val lavender = NotiFlowViolet
    val lavenderLight = NotiFlowVioletLight
    val bgGradient = Brush.verticalGradient(
        listOf(Color(0xFFFFF0F5), Color(0xFFFFF8F3), Color(0xFFF3E5F5))
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(bgGradient),
        contentAlignment = Alignment.Center
    ) {
        // Floating sparkles & decorations
        Canvas(modifier = Modifier.fillMaxSize().alpha(alphaAnim.value)) {
            val w = size.width
            val h = size.height
            val phase = sparklePhase.value

            // Soft glow orbs
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(sakuraLight.copy(alpha = 0.2f), Color.Transparent),
                    center = Offset(w * 0.15f, h * 0.2f), radius = w * 0.35f
                )
            )
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(lavenderLight.copy(alpha = 0.15f), Color.Transparent),
                    center = Offset(w * 0.85f, h * 0.75f), radius = w * 0.4f
                )
            )
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(sakura.copy(alpha = 0.1f), Color.Transparent),
                    center = Offset(w * 0.6f, h * 0.15f), radius = w * 0.25f
                )
            )

            // Sparkle stars scattered around
            val sparkles = listOf(
                Triple(0.12f, 0.08f, 6f), Triple(0.88f, 0.12f, 8f),
                Triple(0.08f, 0.55f, 5f), Triple(0.92f, 0.45f, 7f),
                Triple(0.75f, 0.88f, 6f), Triple(0.25f, 0.85f, 5f),
                Triple(0.5f, 0.05f, 4f), Triple(0.35f, 0.92f, 7f),
                Triple(0.9f, 0.65f, 5f), Triple(0.15f, 0.35f, 4f)
            )
            sparkles.forEachIndexed { i, (fx, fy, r) ->
                val offset = (phase + i * 36f) % 360f
                val alpha = (0.3f + 0.4f * sin(Math.toRadians(offset.toDouble())).toFloat())
                    .coerceIn(0.1f, 0.7f)
                val color = if (i % 2 == 0) sakuraLight else lavenderLight
                drawStar(Offset(w * fx, h * fy), r * (w / 400f), color.copy(alpha = alpha))
            }

            // Tiny floating circles (bokeh)
            val bokeh = listOf(
                Triple(0.2f, 0.3f, 12f), Triple(0.7f, 0.2f, 8f),
                Triple(0.4f, 0.7f, 10f), Triple(0.8f, 0.8f, 6f),
                Triple(0.3f, 0.6f, 7f)
            )
            bokeh.forEachIndexed { i, (fx, fy, r) ->
                val offset = (phase + i * 72f) % 360f
                val yOff = sin(Math.toRadians(offset.toDouble())).toFloat() * 8f
                val alpha = 0.15f + 0.1f * cos(Math.toRadians(offset.toDouble())).toFloat()
                val color = if (i % 2 == 0) sakura else lavender
                drawCircle(
                    color = color.copy(alpha = alpha.coerceIn(0.05f, 0.25f)),
                    radius = r * (w / 400f),
                    center = Offset(w * fx, h * fy + yOff)
                )
            }
        }

        // Central Logo & Branding
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.alpha(alphaAnim.value).scale(scaleAnim.value)
        ) {
            // Logo with sakura gradient
            Box(
                modifier = Modifier
                    .size(120.dp)
                    .background(
                        brush = Brush.linearGradient(listOf(sakura, lavender)),
                        shape = RoundedCornerShape(28.dp)
                    ),
                contentAlignment = Alignment.Center
            ) {
                Canvas(modifier = Modifier.size(56.dp)) {
                    val nPath = Path().apply {
                        val s = size.width / 100f
                        moveTo(25f * s, 20f * s)
                        lineTo(25f * s, 80f * s)
                        lineTo(38f * s, 80f * s)
                        lineTo(62f * s, 38f * s)
                        lineTo(62f * s, 80f * s)
                        lineTo(75f * s, 80f * s)
                        lineTo(75f * s, 20f * s)
                        lineTo(62f * s, 20f * s)
                        lineTo(38f * s, 62f * s)
                        lineTo(38f * s, 20f * s)
                        close()
                    }
                    drawPath(nPath, Color.White)
                }
            }

            Spacer(modifier = Modifier.height(32.dp))

            Text(
                text = "NotiFlow",
                style = MaterialTheme.typography.displayMedium.copy(
                    letterSpacing = (-1).sp,
                    fontWeight = FontWeight.ExtraBold
                ),
                color = Color(0xFF2D1B33)
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "알림을 깔끔하게, 하루를 가볍게 \u2728",
                style = MaterialTheme.typography.labelMedium.copy(
                    letterSpacing = 1.sp,
                    fontWeight = FontWeight.Medium
                ),
                color = Color(0xFF7B6B80)
            )
        }
    }
}

/** Draw a 4-pointed star */
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
