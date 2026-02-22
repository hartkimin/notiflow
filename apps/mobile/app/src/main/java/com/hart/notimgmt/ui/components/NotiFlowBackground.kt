package com.hart.notimgmt.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.hart.notimgmt.R
import com.hart.notimgmt.ui.theme.*

// ============================================
// NotiFlow Background Components
// ============================================

/**
 * NotiFlow이미지 리소스 상수
 */
object NotiFlowImages {
    val SPLASH = R.drawable.notiflow_splash_bg          // 스플래시 배경 (NotiFlow 브랜드)
    val BACKGROUND = R.drawable.notiflow_onboarding_bg  // 온보딩 배경 (NotiFlow 브랜드)
    val HEADER = R.drawable.notiflow_onboarding_bg      // 헤더 배경 (NotiFlow 브랜드)
    val ALBUM_ART = R.drawable.notiflow_splash_bg       // (미사용 — 호환용)
    val MEMBERS = R.drawable.notiflow_onboarding_bg     // (미사용 — 호환용)
}

/**
 * NotiFlow그라데이션 배경 (이미지 없을 때 기본 배경)
 */
@Composable
fun NotiFlowGradientBackground(
    modifier: Modifier = Modifier,
    style: GradientStyle = GradientStyle.DIAGONAL,
    content: @Composable BoxScope.() -> Unit
) {
    val glassColors = NotiFlowDesign.glassColors

    val gradientBrush = when (style) {
        GradientStyle.DIAGONAL -> Brush.linearGradient(
            colors = listOf(
                glassColors.gradientStart,
                glassColors.gradientMiddle,
                glassColors.gradientEnd
            )
        )
        GradientStyle.VERTICAL -> Brush.verticalGradient(
            colors = listOf(
                glassColors.gradientStart,
                glassColors.gradientEnd
            )
        )
        GradientStyle.RADIAL -> Brush.radialGradient(
            colors = listOf(
                glassColors.gradientMiddle,
                glassColors.gradientStart,
                glassColors.gradientEnd
            )
        )
        GradientStyle.SOFT -> Brush.verticalGradient(
            colors = listOf(
                glassColors.gradientStart.copy(alpha = 0.3f),
                Color.Transparent
            )
        )
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(brush = gradientBrush),
        content = content
    )
}

enum class GradientStyle {
    DIAGONAL,
    VERTICAL,
    RADIAL,
    SOFT
}

/**
 * NotiFlow이미지 배경 (사용자가 이미지 추가 시 사용)
 * 이미지 위에 블러 + 그라데이션 오버레이
 */
@Composable
fun NotiFlowImageBackground(
    imageResId: Int? = null,
    imageUrl: String? = null,
    modifier: Modifier = Modifier,
    blurRadius: Float = 0f,
    overlayAlpha: Float = 0.5f,
    content: @Composable BoxScope.() -> Unit
) {
    val glassColors = NotiFlowDesign.glassColors

    Box(modifier = modifier.fillMaxSize()) {
        // Background Image
        if (imageResId != null || imageUrl != null) {
            AsyncImage(
                model = ImageRequest.Builder(LocalContext.current)
                    .data(imageResId ?: imageUrl)
                    .crossfade(true)
                    .build(),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxSize()
                    .then(if (blurRadius > 0) Modifier.blur(blurRadius.dp) else Modifier)
            )
        }

        // Gradient Overlay for readability
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    brush = Brush.verticalGradient(
                        colors = listOf(
                            Color.Transparent,
                            glassColors.gradientEnd.copy(alpha = overlayAlpha * 0.5f),
                            glassColors.gradientEnd.copy(alpha = overlayAlpha)
                        )
                    )
                )
        )

        // Content
        content()
    }
}

/**
 * NotiFlow스플래시 배경
 */
@Composable
fun NotiFlowSplashBackground(
    imageResId: Int? = NotiFlowImages.SPLASH,
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit
) {
    val glassColors = NotiFlowDesign.glassColors

    Box(modifier = modifier.fillMaxSize()) {
        if (imageResId != null) {
            // 이미지가 있으면 이미지 배경
            AsyncImage(
                model = ImageRequest.Builder(LocalContext.current)
                    .data(imageResId)
                    .crossfade(true)
                    .build(),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxSize()
                    .blur(2.dp)
            )

            // 살짝 어두운 오버레이
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.25f))
            )
        } else {
            // 이미지 없으면 그라데이션 배경
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        brush = Brush.verticalGradient(
                            colors = listOf(
                                glassColors.gradientStart,
                                glassColors.gradientMiddle,
                                glassColors.gradientEnd
                            )
                        )
                    )
            )
        }

        // Content
        content()
    }
}

/**
 * NotiFlow상단 헤더 배경 (페이드아웃)
 */
@Deprecated("Use NotiFlowHeader instead — provides collapsing behavior and integrated gradient")
@Composable
fun NotiFlowHeaderBackground(
    imageResId: Int? = NotiFlowImages.HEADER,
    height: Int = 200,
    modifier: Modifier = Modifier
) {
    val glassColors = NotiFlowDesign.glassColors

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(height.dp)
    ) {
        if (imageResId != null) {
            AsyncImage(
                model = ImageRequest.Builder(LocalContext.current)
                    .data(imageResId)
                    .crossfade(true)
                    .build(),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxSize()
                    .blur(1.dp)
            )

            // 오버레이
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        brush = Brush.verticalGradient(
                            colors = listOf(
                                NotiFlowIndigo.copy(alpha = 0.3f),
                                NotiFlowIndigo.copy(alpha = 0.1f),
                                Color.Transparent
                            )
                        )
                    )
            )
        } else {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        brush = Brush.horizontalGradient(
                            colors = listOf(
                                glassColors.gradientStart,
                                glassColors.gradientMiddle
                            )
                        )
                    )
            )
        }

        // Fade out overlay
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    brush = Brush.verticalGradient(
                        colors = listOf(
                            Color.Transparent,
                            Color.Transparent,
                            androidx.compose.material3.MaterialTheme.colorScheme.background
                        )
                    )
                )
        )
    }
}

/**
 * 글래스 효과가 있는 스크린 래퍼
 */
@Deprecated("Use NotiFlowScreenWrapper instead — provides collapsing header and better space usage")
@Suppress("DEPRECATION")
@Composable
fun NotiFlowLegacyScreenWrapper(
    modifier: Modifier = Modifier,
    showHeader: Boolean = true,
    headerImageResId: Int? = NotiFlowImages.HEADER,
    content: @Composable BoxScope.() -> Unit
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(androidx.compose.material3.MaterialTheme.colorScheme.background)
    ) {
        // Optional header background
        if (showHeader) {
            NotiFlowHeaderBackground(
                imageResId = headerImageResId,
                height = 180
            )
        }

        // Content
        content()
    }
}
