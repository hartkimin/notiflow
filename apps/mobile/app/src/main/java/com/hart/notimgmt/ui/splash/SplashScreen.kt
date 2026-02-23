package com.hart.notimgmt.ui.splash

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asComposePath
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun SplashScreen(onFinished: () -> Unit) {
    val alphaAnim = remember { Animatable(0f) }
    val scaleAnim = remember { Animatable(0.85f) }
    val waveOffsetAnim = remember { Animatable(0f) }

    LaunchedEffect(Unit) {
        launch { alphaAnim.animateTo(1f, tween(1000, easing = EaseOutExpo)) }
        launch { scaleAnim.animateTo(1f, tween(1200, easing = EaseOutBack)) }
        launch {
            waveOffsetAnim.animateTo(
                targetValue = 1f,
                animationSpec = infiniteRepeatable(
                    animation = tween(4000, easing = LinearEasing),
                    repeatMode = RepeatMode.Reverse
                )
            )
        }
        delay(3000)
        onFinished()
    }

    val brandBlue = Color(0xFF4B4DFF)
    val brandPurple = Color(0xFF934DFF)
    val bgDark = Color(0xFF050505)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(bgDark),
        contentAlignment = Alignment.Center
    ) {
        // Background abstract elements (Waves & Orbs)
        Canvas(modifier = Modifier.fillMaxSize().alpha(alphaAnim.value)) {
            val width = size.width
            val height = size.height

            // Glow Orbs mapped to canvas
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(brandBlue.copy(alpha = 0.3f), Color.Transparent),
                    center = Offset(width * 0.2f, height * 0.25f),
                    radius = width * 0.5f
                )
            )
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(brandPurple.copy(alpha = 0.3f), Color.Transparent),
                    center = Offset(width * 0.8f, height * 0.7f),
                    radius = width * 0.6f
                )
            )
            
            // Scattered Dots
            drawCircle(color = brandBlue.copy(alpha = 0.4f), radius = 8f, center = Offset(width * 0.15f, height * 0.1f))
            drawCircle(color = brandPurple.copy(alpha = 0.5f), radius = 12f, center = Offset(width * 0.85f, height * 0.2f))
            drawCircle(color = brandBlue.copy(alpha = 0.3f), radius = 10f, center = Offset(width * 0.2f, height * 0.85f))
            drawCircle(color = brandPurple.copy(alpha = 0.4f), radius = 6f, center = Offset(width * 0.85f, height * 0.6f))
            
            // Vector Waves (Simplified path using Compose Path)
            val scaleX = width / 400f
            val scaleY = height / 800f
            
            val wave1 = androidx.core.graphics.PathParser.createPathFromPathData(
                "M-50 150C50 100 150 250 200 400C250 550 350 700 450 650"
            ).asComposePath()
            
            val wave2 = androidx.core.graphics.PathParser.createPathFromPathData(
                "M450 150C350 100 250 250 200 400C150 550 50 700 -50 650"
            ).asComposePath()
            
            val waveOffsetY = waveOffsetAnim.value * 60f
            
            withTransform({
                scale(scaleX, scaleY, pivot = Offset.Zero)
                translate(0f, waveOffsetY)
            }) {
                drawPath(
                    path = wave1,
                    brush = Brush.linearGradient(
                        colors = listOf(brandBlue, brandPurple),
                        start = Offset(0f, 0f),
                        end = Offset(400f, 800f)
                    ),
                    style = Stroke(width = 2f),
                    alpha = 0.5f
                )
                drawPath(
                    path = wave2,
                    brush = Brush.linearGradient(
                        colors = listOf(brandPurple, brandBlue),
                        start = Offset(400f, 0f),
                        end = Offset(0f, 800f)
                    ),
                    style = Stroke(width = 2f),
                    alpha = 0.5f
                )
            }
        }

        // Central N Logo and Branding
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .alpha(alphaAnim.value)
                .scale(scaleAnim.value)
        ) {
            // Logo Container
            Box(
                modifier = Modifier.size(120.dp),
                contentAlignment = Alignment.Center
            ) {
                // Outer Glow
                Box(
                    modifier = Modifier
                        .matchParentSize()
                        .blur(32.dp)
                        .background(
                            brush = Brush.linearGradient(listOf(brandBlue.copy(alpha=0.6f), brandPurple.copy(alpha=0.6f))),
                            shape = androidx.compose.foundation.shape.RoundedCornerShape(24.dp)
                        )
                )
                
                // Actual Shape
                Box(
                    modifier = Modifier
                        .matchParentSize()
                        .background(
                            brush = Brush.linearGradient(listOf(brandBlue, brandPurple)),
                            shape = androidx.compose.foundation.shape.RoundedCornerShape(24.dp)
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Canvas(modifier = Modifier.size(60.dp)) {
                        val nPath = androidx.core.graphics.PathParser.createPathFromPathData(
                            "M25 20V80H38L62 38V80H75V20H62L38 62V20H25Z"
                        ).asComposePath()
                        withTransform({
                            scale(size.width / 100f, size.height / 100f, pivot = Offset.Zero)
                        }) {
                            drawPath(
                                path = nPath,
                                color = Color.White
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(32.dp))

            Text(
                text = "NotiFlow",
                style = MaterialTheme.typography.displayMedium.copy(
                    letterSpacing = (-1).sp,
                    fontWeight = FontWeight.ExtraBold
                ),
                color = Color.White
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Text(
                text = "FOCUS RECLAIMED",
                style = MaterialTheme.typography.labelMedium.copy(
                    letterSpacing = 4.sp,
                    fontWeight = FontWeight.Bold
                ),
                color = Color(0xFFA0A0A0)
            )
        }
    }
}
