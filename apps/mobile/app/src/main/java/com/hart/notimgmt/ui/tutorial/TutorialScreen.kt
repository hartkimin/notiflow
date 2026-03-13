package com.hart.notimgmt.ui.tutorial

import androidx.activity.compose.BackHandler
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.hart.notimgmt.ui.theme.NotiRouteDesign
import kotlinx.coroutines.launch

@Composable
fun TutorialScreen(
    fromSettings: Boolean = false,
    onComplete: () -> Unit
) {
    val pagerState = rememberPagerState(pageCount = { tutorialPages.size })
    val coroutineScope = rememberCoroutineScope()
    
    val bgDark = Color(0xFF050505)
    val brandBlue = Color(0xFF4B4DFF)
    val glassWhite = Color(0x1AFFFFFF)

    val isLastPage = pagerState.currentPage == tutorialPages.lastIndex

    if (!fromSettings) {
        BackHandler { /* block back press during first-run */ }
    } else {
        BackHandler { onComplete() }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(bgDark)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Top Section - Skip Button
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.End
            ) {
                if (!isLastPage) {
                    TextButton(onClick = onComplete) {
                        Text("Skip", color = Color.Gray, style = MaterialTheme.typography.bodyMedium)
                    }
                } else {
                    Spacer(modifier = Modifier.height(48.dp))
                }
            }

            // Embedded "Live App" Container (Taking ~60% of vertical space)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(horizontal = 24.dp, vertical = 8.dp),
                contentAlignment = Alignment.Center
            ) {
                // Background Glow behind the demo container
                Box(
                    modifier = Modifier
                        .matchParentSize()
                        .padding(16.dp)
                        .background(
                            brush = Brush.radialGradient(
                                colors = listOf(brandBlue.copy(alpha = 0.2f), Color.Transparent),
                                radius = 600f
                            )
                        )
                )

                // Demo Container Frame
                Surface(
                    modifier = Modifier
                        .fillMaxSize()
                        .clip(RoundedCornerShape(24.dp)),
                    color = bgDark,
                    border = BorderStroke(2.dp, brandBlue.copy(alpha = 0.5f))
                ) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        // The Pager handles the embedded UI switching smoothly
                        HorizontalPager(
                            state = pagerState,
                            modifier = Modifier.fillMaxSize(),
                            userScrollEnabled = false // Guided by the bottom button
                        ) { page ->
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    // Scale the content to fit within the demo window frame
                                    .scale(0.85f),
                                contentAlignment = Alignment.Center
                            ) {
                                TutorialMockAppContent(tutorialPages[page].demoType)
                            }
                        }
                    }
                }
            }

            // Bottom Section - Glassmorphic Info Panel
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                shape = RoundedCornerShape(24.dp),
                color = glassWhite,
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.1f))
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Pager Indicators
                    Row(
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        repeat(tutorialPages.size) { index ->
                            val dotColor by animateColorAsState(
                                targetValue = if (index == pagerState.currentPage) brandBlue else Color.White.copy(alpha = 0.2f),
                                label = "dot_color"
                            )
                            Box(
                                modifier = Modifier
                                    .size(if (index == pagerState.currentPage) 8.dp else 6.dp)
                                    .clip(CircleShape)
                                    .background(dotColor)
                            )
                            if (index < tutorialPages.lastIndex) {
                                Spacer(modifier = Modifier.width(8.dp))
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    // Title
                    Text(
                        text = tutorialPages[pagerState.currentPage].title,
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                        color = Color.White,
                        textAlign = TextAlign.Center
                    )
                    
                    Spacer(modifier = Modifier.height(8.dp))

                    // Description
                    Text(
                        text = tutorialPages[pagerState.currentPage].description,
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color(0xFFA0A0A0), // Soft Grey
                        textAlign = TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(32.dp))

                    // Next / Finish Button
                    Button(
                        onClick = {
                            if (isLastPage) onComplete()
                            else coroutineScope.launch { pagerState.animateScrollToPage(pagerState.currentPage + 1) }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp)
                            .background(
                                brush = Brush.horizontalGradient(listOf(brandBlue, Color(0xFF934DFF))),
                                shape = RoundedCornerShape(16.dp)
                            ),
                        colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                        contentPadding = PaddingValues()
                    ) {
                        Text(
                            text = if (isLastPage) "Get Started" else "Next",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                            color = Color.White
                        )
                    }
                }
            }
        }
    }
}

// Enum defining which mock view to show in the demo container
enum class DemoType {
    CHATROOM, TIMELINE, AI_INSIGHTS, KANBAN, SETTINGS
}

@Composable
private fun TutorialMockAppContent(demoType: DemoType) {
    // A shared modern background for the mock screens
    Box(
        modifier = Modifier
            .fillMaxSize()
            .clip(RoundedCornerShape(24.dp))
            .background(Color(0xFF0F0F13)), // Slightly elevated dark
        contentAlignment = Alignment.Center
    ) {
        when (demoType) {
            DemoType.TIMELINE -> MockTimelineScreen()
            DemoType.CHATROOM -> MockChatroomScreen()
            DemoType.AI_INSIGHTS -> MockAIAnalysisScreen()
            DemoType.KANBAN -> MockKanbanScreen()
            DemoType.SETTINGS -> MockSettingsScreen()
        }
    }
}

// ==========================================
// MOCK SCREENS (Scalable "Live" Demos)
// ==========================================

@Composable
private fun MockTimelineScreen() {
    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp)
    ) {
        // Pseudo Top Bar
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(modifier = Modifier.size(32.dp).clip(CircleShape).background(Color(0xFF2C2C35)))
            Spacer(modifier = Modifier.width(12.dp))
            Box(modifier = Modifier.height(16.dp).width(120.dp).background(Color(0xFF2C2C35), RoundedCornerShape(8.dp)))
        }
        Spacer(modifier = Modifier.height(24.dp))
        
        // Mock Timeline Items
        repeat(4) {
            Row(modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp)) {
                // Timeline Dot
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(modifier = Modifier.size(12.dp).clip(CircleShape).background(Color(0xFF4B4DFF)))
                    Box(modifier = Modifier.width(2.dp).height(60.dp).background(Color(0xFF2C2C35)))
                }
                Spacer(modifier = Modifier.width(16.dp))
                // Card
                Box(
                    modifier = Modifier.weight(1f).height(72.dp)
                        .background(Color(0xFF1A1A24), RoundedCornerShape(12.dp))
                        .padding(12.dp)
                ) {
                    Column {
                        Box(modifier = Modifier.height(12.dp).width(80.dp).background(Color(0xFF4B4DFF).copy(alpha=0.5f), RoundedCornerShape(4.dp)))
                        Spacer(modifier = Modifier.height(8.dp))
                        Box(modifier = Modifier.height(10.dp).fillMaxWidth(0.8f).background(Color(0xFF3C3C45), RoundedCornerShape(4.dp)))
                        Spacer(modifier = Modifier.height(6.dp))
                        Box(modifier = Modifier.height(10.dp).fillMaxWidth(0.5f).background(Color(0xFF3C3C45), RoundedCornerShape(4.dp)))
                    }
                }
            }
        }
    }
}

@Composable
private fun MockChatroomScreen() {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        // App icons row
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            repeat(4) {
                Box(modifier = Modifier.size(48.dp).clip(RoundedCornerShape(12.dp)).background(Color(0xFF2C2C35)))
            }
        }
        Spacer(modifier = Modifier.height(24.dp))
        // Chat list
        repeat(5) {
            Row(modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(modifier = Modifier.size(40.dp).clip(CircleShape).background(Color(0xFF4B4DFF).copy(alpha = 0.8f)))
                Spacer(modifier = Modifier.width(16.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Box(modifier = Modifier.height(14.dp).width(100.dp).background(Color(0xFFE0E0E0), RoundedCornerShape(4.dp)))
                    Spacer(modifier = Modifier.height(8.dp))
                    Box(modifier = Modifier.height(10.dp).fillMaxWidth(0.9f).background(Color(0xFF3C3C45), RoundedCornerShape(4.dp)))
                }
            }
        }
    }
}

@Composable
private fun MockAIAnalysisScreen() {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Spacer(modifier = Modifier.height(32.dp))
        // Huge circular graph or AI icon
        Box(
            modifier = Modifier.size(160.dp).clip(CircleShape)
                .background(Brush.radialGradient(listOf(Color(0xFF4B4DFF), Color(0xFF934DFF), Color.Transparent))),
            contentAlignment = Alignment.Center
        ) {
            Box(modifier = Modifier.size(100.dp).clip(CircleShape).background(Color(0xFF1A1A24)))
        }
        Spacer(modifier = Modifier.height(40.dp))
        // Progress bars
        repeat(3) {
            Column(modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp)) {
                Box(modifier = Modifier.height(12.dp).width(60.dp).background(Color(0xFFE0E0E0), RoundedCornerShape(4.dp)))
                Spacer(modifier = Modifier.height(8.dp))
                Box(
                    modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)).background(Color(0xFF2C2C35))
                ) {
                    Box(modifier = Modifier.fillMaxWidth(0.7f).fillMaxHeight().background(Color(0xFF4B4DFF)))
                }
            }
        }
    }
}

@Composable
private fun MockKanbanScreen() {
    Row(modifier = Modifier.fillMaxSize().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        // Columns
        val heights = listOf(3, 2)
        heights.forEach { cards ->
            Column(modifier = Modifier.weight(1f).fillMaxHeight().background(Color(0xFF1A1A24), RoundedCornerShape(12.dp)).padding(8.dp)) {
                Box(modifier = Modifier.height(16.dp).width(60.dp).background(Color(0xFF3C3C45), RoundedCornerShape(4.dp)))
                Spacer(modifier = Modifier.height(16.dp))
                repeat(cards) {
                    Box(
                        modifier = Modifier.fillMaxWidth().height(80.dp).padding(bottom = 12.dp)
                            .background(Color(0xFF2C2C35), RoundedCornerShape(8.dp)).padding(8.dp)
                    ) {
                        Column {
                            Box(modifier = Modifier.height(10.dp).fillMaxWidth(0.8f).background(Color(0xFF4B4DFF), RoundedCornerShape(4.dp)))
                            Spacer(modifier = Modifier.height(8.dp))
                            Box(modifier = Modifier.height(8.dp).fillMaxWidth(0.6f).background(Color(0xFF3C3C45), RoundedCornerShape(4.dp)))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MockSettingsScreen() {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        // Profile area
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(modifier = Modifier.size(60.dp).clip(CircleShape).background(Color(0xFF4B4DFF)))
            Spacer(modifier = Modifier.width(16.dp))
            Column {
                Box(modifier = Modifier.height(16.dp).width(120.dp).background(Color(0xFFE0E0E0), RoundedCornerShape(4.dp)))
                Spacer(modifier = Modifier.height(8.dp))
                Box(modifier = Modifier.height(12.dp).width(80.dp).background(Color(0xFF3C3C45), RoundedCornerShape(4.dp)))
            }
        }
        Spacer(modifier = Modifier.height(40.dp))
        // Settings Toggles
        repeat(4) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(bottom = 24.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(modifier = Modifier.size(32.dp).clip(RoundedCornerShape(8.dp)).background(Color(0xFF2C2C35)))
                    Spacer(modifier = Modifier.width(16.dp))
                    Box(modifier = Modifier.height(14.dp).width(100.dp).background(Color(0xFFE0E0E0), RoundedCornerShape(4.dp)))
                }
                // Mock Switch
                Box(modifier = Modifier.width(44.dp).height(24.dp).clip(RoundedCornerShape(12.dp)).background(Color(0xFF4B4DFF))) {
                    Box(modifier = Modifier.size(20.dp).align(Alignment.CenterEnd).padding(end = 2.dp).clip(CircleShape).background(Color.White))
                }
            }
        }
    }
}

