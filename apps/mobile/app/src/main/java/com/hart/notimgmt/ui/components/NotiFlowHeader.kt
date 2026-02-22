package com.hart.notimgmt.ui.components

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.hart.notimgmt.ui.theme.NotiFlowDesign

// ============================================
// NotiFlow Collapsing Header System
// ============================================

/**
 * 헤더 확장/축소 상태 관리
 */
@Stable
class NotiFlowHeaderState(
    val expandedHeightPx: Float,
    val collapsedHeightPx: Float,
    initialProgress: Float = 0f
) {
    /**
     * 0f = 완전 확장, 1f = 완전 축소
     */
    var progress by mutableFloatStateOf(initialProgress)
        private set

    val currentHeightPx: Float
        get() = expandedHeightPx - (expandedHeightPx - collapsedHeightPx) * progress

    /**
     * 스크롤 델타를 소비하고 실제 소비량을 반환
     * positive delta = 위로 스크롤 (헤더 축소)
     * negative delta = 아래로 스크롤 (헤더 확장)
     */
    fun consume(deltaY: Float): Float {
        val range = expandedHeightPx - collapsedHeightPx
        if (range <= 0f) return 0f

        val oldProgress = progress
        // 위로 스크롤 (deltaY < 0) → 헤더 축소 (progress 증가)
        // 아래로 스크롤 (deltaY > 0) → 헤더 확장 (progress 감소)
        val newProgress = (progress + (-deltaY / range)).coerceIn(0f, 1f)
        progress = newProgress
        return -(newProgress - oldProgress) * range
    }

    companion object {
        val Saver = Saver<NotiFlowHeaderState, List<Float>>(
            save = { listOf(it.expandedHeightPx, it.collapsedHeightPx, it.progress) },
            restore = { NotiFlowHeaderState(it[0], it[1], it[2]) }
        )
    }
}

@Composable
fun rememberNotiFlowHeaderState(
    expandedHeight: Dp,
    collapsedHeight: Dp = 56.dp
): NotiFlowHeaderState {
    val density = LocalDensity.current
    val expandedPx = with(density) { expandedHeight.toPx() }
    val collapsedPx = with(density) { collapsedHeight.toPx() }
    return rememberSaveable(expandedPx, collapsedPx, saver = NotiFlowHeaderState.Saver) {
        NotiFlowHeaderState(expandedPx, collapsedPx)
    }
}

/**
 * NestedScrollConnection: 스크롤 이벤트를 가로채 헤더 축소/확장
 */
class NotiFlowHeaderNestedScrollConnection(
    private val state: NotiFlowHeaderState
) : NestedScrollConnection {

    override fun onPreScroll(available: Offset, source: NestedScrollSource): Offset {
        // 위로 스크롤 시 (available.y < 0) 헤더 먼저 축소
        if (available.y < 0f) {
            val consumed = state.consume(available.y)
            return Offset(0f, consumed)
        }
        return Offset.Zero
    }

    override fun onPostScroll(
        consumed: Offset,
        available: Offset,
        source: NestedScrollSource
    ): Offset {
        // 아래로 스크롤 시 콘텐츠가 소비 후 남은 스크롤로 헤더 확장
        if (available.y > 0f) {
            val headerConsumed = state.consume(available.y)
            return Offset(0f, headerConsumed)
        }
        return Offset.Zero
    }
}

/**
 * NotiFlow 그라데이션 헤더 Composable
 *
 * @param title 화면 제목 (항상 표시)
 * @param state 헤더 확장/축소 상태
 * @param actions 우측 액션 아이콘 영역
 * @param expandedContent 확장 영역 슬롯 (progress에 따라 fade out)
 */
@Composable
fun NotiFlowHeader(
    title: String,
    state: NotiFlowHeaderState,
    modifier: Modifier = Modifier,
    actions: @Composable RowScope.() -> Unit = {},
    expandedContent: @Composable () -> Unit = {}
) {
    val glassColors = NotiFlowDesign.glassColors
    val density = LocalDensity.current
    val currentHeight = with(density) { state.currentHeightPx.toDp() }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(currentHeight)
            .background(
                brush = Brush.verticalGradient(
                    colors = listOf(
                        glassColors.gradientStart.copy(alpha = 0.6f - 0.3f * state.progress),
                        glassColors.gradientMiddle.copy(alpha = 0.3f - 0.2f * state.progress),
                        MaterialTheme.colorScheme.background
                    )
                )
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
        ) {
            // 상단 56dp: 제목 + 액션 (항상 표시)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onBackground,
                    modifier = Modifier.weight(1f)
                )
                actions()
            }

            // 확장 영역 — progress에 따라 fade out
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f, fill = false)
                    .graphicsLayer {
                        alpha = 1f - state.progress
                    }
            ) {
                expandedContent()
            }
        }
    }
}

/**
 * NotiFlowScreenWrapper — NotiFlowLegacyScreenWrapper 대체
 *
 * 그라데이션 헤더 + nestedScroll connection + 콘텐츠 슬롯
 */
@Composable
fun NotiFlowScreenWrapper(
    title: String,
    modifier: Modifier = Modifier,
    expandedHeight: Dp = 140.dp,
    actions: @Composable RowScope.() -> Unit = {},
    expandedContent: @Composable () -> Unit = {},
    content: @Composable BoxScope.() -> Unit
) {
    val headerState = rememberNotiFlowHeaderState(
        expandedHeight = expandedHeight
    )
    val nestedScrollConnection = NotiFlowHeaderNestedScrollConnection(headerState)

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .nestedScroll(nestedScrollConnection)
        ) {
            NotiFlowHeader(
                title = title,
                state = headerState,
                actions = actions,
                expandedContent = expandedContent
            )

            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .weight(1f)
            ) {
                content()
            }
        }
    }
}
