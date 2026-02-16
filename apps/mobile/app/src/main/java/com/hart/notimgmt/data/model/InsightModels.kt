package com.hart.notimgmt.data.model

data class WeeklySummary(
    val totalCount: Int,
    val previousWeekCount: Int,
    val completionRate: Int,
    val topSenders: List<SenderStat>,
    val categoryBreakdown: List<CategoryBreakdown>
)

data class SenderStat(
    val sender: String,
    val count: Int
)

data class CategoryBreakdown(
    val categoryId: String?,
    val categoryName: String,
    val categoryColor: Int,
    val count: Int
)
