package com.hart.notimgmt.data.repository

import com.hart.notimgmt.data.db.dao.CapturedMessageDao
import com.hart.notimgmt.data.db.dao.CategoryDao
import com.hart.notimgmt.data.db.dao.StatusStepDao
import com.hart.notimgmt.data.model.CategoryBreakdown
import com.hart.notimgmt.data.model.SenderStat
import com.hart.notimgmt.data.model.WeeklySummary
import java.util.Calendar
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class InsightRepository @Inject constructor(
    private val messageDao: CapturedMessageDao,
    private val categoryDao: CategoryDao,
    private val statusStepDao: StatusStepDao
) {
    suspend fun getWeeklySummary(): WeeklySummary {
        val now = System.currentTimeMillis()
        val weekAgo = now - 7L * 24 * 60 * 60 * 1000
        val twoWeeksAgo = now - 14L * 24 * 60 * 60 * 1000

        // Total this week
        val totalCount = messageDao.getTotalCountSince(weekAgo)
        val previousWeekCount = messageDao.getTotalCountSince(twoWeeksAgo) - totalCount

        // Completion rate
        val lastStep = statusStepDao.getLastStep()
        val completedCount = if (lastStep != null) {
            messageDao.getCompletedCountSince(weekAgo, lastStep.id)
        } else 0
        val completionRate = if (totalCount > 0) (completedCount * 100 / totalCount) else 0

        // Top senders
        val topSendersRaw = messageDao.getTopSenders(weekAgo, 5)
        val topSenders = topSendersRaw.map { SenderStat(it.sender, it.count) }

        // Category breakdown
        val categoryBreakdownRaw = messageDao.getCategoryBreakdown(weekAgo)
        val allCategories = categoryDao.getAllOnce()
        val categoryMap = allCategories.associate { it.id to Pair(it.name, it.color) }

        val categoryBreakdown = categoryBreakdownRaw.map { cb ->
            val (name, color) = categoryMap[cb.categoryId] ?: Pair("미분류", 0xFF6B7280.toInt())
            CategoryBreakdown(
                categoryId = cb.categoryId,
                categoryName = name,
                categoryColor = color,
                count = cb.count
            )
        }

        return WeeklySummary(
            totalCount = totalCount,
            previousWeekCount = previousWeekCount,
            completionRate = completionRate,
            topSenders = topSenders,
            categoryBreakdown = categoryBreakdown
        )
    }
}
