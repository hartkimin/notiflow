package com.hart.notimgmt.ui.settings

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.hart.notimgmt.ui.components.NotiFlowScreenWrapper
import com.hart.notimgmt.ui.filter.AppFilterScreen
import com.hart.notimgmt.ui.filter.FilterScreen
import com.hart.notimgmt.ui.status.StatusScreen
import com.hart.notimgmt.ui.theme.TwsTheme
import kotlinx.coroutines.launch

@Composable
fun SettingsScreen(onLogout: () -> Unit = {}) {
    val pagerState = rememberPagerState(pageCount = { 4 })
    val coroutineScope = rememberCoroutineScope()
    val glassColors = TwsTheme.glassColors

    val tabTitles = listOf("키워드", "상태", "앱", "설정")

    NotiFlowScreenWrapper(
        title = "설정",
        expandedHeight = 56.dp
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            TabRow(
                selectedTabIndex = pagerState.currentPage,
                containerColor = glassColors.surfaceLight,
                contentColor = MaterialTheme.colorScheme.onSurface,
                divider = {},
                indicator = { tabPositions ->
                    if (pagerState.currentPage < tabPositions.size) {
                        TabRowDefaults.SecondaryIndicator(
                            modifier = Modifier.tabIndicatorOffset(tabPositions[pagerState.currentPage]),
                            height = 2.dp,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            ) {
                tabTitles.forEachIndexed { index, title ->
                    Tab(
                        selected = pagerState.currentPage == index,
                        onClick = {
                            coroutineScope.launch { pagerState.animateScrollToPage(index) }
                        },
                        modifier = Modifier.height(36.dp),
                        text = {
                            Text(
                                title,
                                style = MaterialTheme.typography.labelMedium,
                                color = if (pagerState.currentPage == index)
                                    MaterialTheme.colorScheme.primary
                                else
                                    MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    )
                }
            }

            HorizontalPager(
                state = pagerState,
                modifier = Modifier.fillMaxSize()
            ) { page ->
                when (page) {
                    0 -> FilterScreen()
                    1 -> StatusScreen()
                    2 -> AppFilterScreen()
                    3 -> GeneralScreen(onLogout = onLogout)
                }
            }
        }
    }
}
