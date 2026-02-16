package com.hart.notimgmt.ui.insight

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Analytics
import androidx.compose.material.icons.automirrored.filled.TrendingDown
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.hart.notimgmt.data.model.CategoryBreakdown
import com.hart.notimgmt.data.model.SenderStat
import com.hart.notimgmt.data.model.WeeklySummary
import com.hart.notimgmt.ui.components.GlassCard
import com.hart.notimgmt.viewmodel.InsightViewModel

@Composable
fun InsightSection(
    viewModel: InsightViewModel = hiltViewModel()
) {
    val summary by viewModel.weeklySummary.collectAsState()

    if (summary == null) return

    val data = summary ?: return

    // 데이터가 전혀 없으면 섹션 표시하지 않음
    if (data.totalCount == 0 && data.previousWeekCount == 0) return

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
    ) {
        // 헤더
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Analytics,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
                tint = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "이번 주 알림 인사이트",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        GlassCard(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                // 총 건수 + 트렌드
                WeeklyTotalRow(data)

                Spacer(modifier = Modifier.height(16.dp))

                // 처리율
                ProcessingRateRow(data.completionRate)

                // 카테고리 막대 그래프
                if (data.categoryBreakdown.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(16.dp))
                    CategoryBarChart(data.categoryBreakdown, data.totalCount)
                }

                // 상위 발신자
                if (data.topSenders.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(16.dp))
                    TopSendersSection(data.topSenders)
                }
            }
        }
    }
}

@Composable
private fun WeeklyTotalRow(summary: WeeklySummary) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column {
            Text(
                text = "총 수신",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = "${summary.totalCount}건",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )
        }

        // 트렌드
        val delta = summary.totalCount - summary.previousWeekCount
        val isUp = delta >= 0
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = if (isUp) Icons.AutoMirrored.Filled.TrendingUp else Icons.AutoMirrored.Filled.TrendingDown,
                contentDescription = null,
                modifier = Modifier.size(18.dp),
                tint = if (isUp) Color(0xFFF59E0B) else Color(0xFF10B981)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = "지난 주 대비 ${if (isUp) "+" else ""}$delta",
                style = MaterialTheme.typography.labelSmall,
                color = if (isUp) Color(0xFFF59E0B) else Color(0xFF10B981)
            )
        }
    }
}

@Composable
private fun ProcessingRateRow(rate: Int) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "처리율",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = "$rate%",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = when {
                    rate >= 80 -> Color(0xFF10B981)
                    rate >= 50 -> Color(0xFFF59E0B)
                    else -> MaterialTheme.colorScheme.error
                }
            )
        }
        Spacer(modifier = Modifier.height(4.dp))
        // Progress bar
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(RoundedCornerShape(3.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(fraction = rate / 100f)
                    .height(6.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(
                        when {
                            rate >= 80 -> Color(0xFF10B981)
                            rate >= 50 -> Color(0xFFF59E0B)
                            else -> MaterialTheme.colorScheme.error
                        }
                    )
            )
        }
    }
}

@Composable
private fun CategoryBarChart(breakdown: List<CategoryBreakdown>, total: Int) {
    Column {
        Text(
            text = "카테고리별",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(8.dp))

        breakdown.take(5).forEach { item ->
            val fraction = if (total > 0) item.count.toFloat() / total else 0f
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 3.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(Color(item.categoryColor))
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = item.categoryName,
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.width(60.dp),
                    maxLines = 1
                )
                Spacer(modifier = Modifier.width(8.dp))
                // Bar
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(8.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(fraction = fraction)
                            .height(8.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(Color(item.categoryColor))
                    )
                }
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "${item.count}",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

@Composable
private fun TopSendersSection(senders: List<SenderStat>) {
    Column {
        Text(
            text = "상위 발신자",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(8.dp))

        senders.take(3).forEachIndexed { index, sender ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "${index + 1}.",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.width(20.dp)
                )
                Text(
                    text = sender.sender,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.weight(1f),
                    maxLines = 1
                )
                Text(
                    text = "${sender.count}건",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
