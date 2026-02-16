package com.hart.notimgmt.data.repository

import com.hart.notimgmt.data.db.dao.PlanDao
import com.hart.notimgmt.data.db.entity.PlanEntity
import com.hart.notimgmt.data.sync.SyncManager
import kotlinx.coroutines.flow.Flow
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlanRepository @Inject constructor(
    private val planDao: PlanDao,
    private val syncManager: SyncManager,
    private val dayCategoryRepository: DayCategoryRepository
) {
    fun getByDate(date: Long): Flow<List<PlanEntity>> = planDao.getByDate(date)

    fun getByDateRange(startDate: Long, endDate: Long): Flow<List<PlanEntity>> =
        planDao.getByDateRange(startDate, endDate)

    suspend fun getById(id: String): PlanEntity? = planDao.getById(id)

    suspend fun insert(plan: PlanEntity): String {
        val entity = plan.copy(updatedAt = System.currentTimeMillis())
        planDao.upsert(entity)
        syncManager.syncPlan(entity)
        return entity.id
    }

    suspend fun update(plan: PlanEntity) {
        val entity = plan.copy(updatedAt = System.currentTimeMillis())
        planDao.update(entity)
        syncManager.syncPlan(entity)
    }

    suspend fun toggleCompletion(id: String, isCompleted: Boolean) {
        planDao.updateCompletion(id, isCompleted)
        planDao.getById(id)?.let { syncManager.syncPlan(it) }
    }

    suspend fun delete(plan: PlanEntity) {
        val entity = plan.copy(isDeleted = true, updatedAt = System.currentTimeMillis())
        planDao.update(entity)
        syncManager.syncPlan(entity)
    }

    suspend fun getMaxOrderIndex(date: Long, categoryId: String?): Int =
        planDao.getMaxOrderIndex(date, categoryId)

    /**
     * Copy plans from the same day of the previous week for a specific category.
     * Only copies plans that match the given categoryId.
     */
    suspend fun copyPreviousDayForCategory(categoryId: String, targetDate: Long) {
        val dayMillis = 24 * 60 * 60 * 1000L
        val sourceDate = targetDate - 7 * dayMillis
        val sourcePlans = planDao.getByDateRangeOnce(sourceDate, sourceDate + dayMillis)
            .filter { it.categoryId == categoryId }
        if (sourcePlans.isEmpty()) return
        val now = System.currentTimeMillis()
        val maxIndex = planDao.getMaxOrderIndex(targetDate, categoryId)
        val copied = sourcePlans.mapIndexed { index, plan ->
            plan.copy(
                id = UUID.randomUUID().toString(),
                date = targetDate,
                isCompleted = false,
                linkedMessageId = null,
                orderNumber = null,
                orderIndex = maxIndex + 1 + index,
                createdAt = now,
                updatedAt = now
            )
        }
        planDao.upsertAll(copied)
        copied.forEach { syncManager.syncPlan(it) }
    }

    /**
     * Copy all plans from source week to target week.
     * New UUIDs are assigned, dates are shifted, and isCompleted is reset.
     */
    suspend fun copyWeek(sourceStart: Long, targetStart: Long) {
        val dayMillis = 24 * 60 * 60 * 1000L
        val sourcePlans = planDao.getByDateRangeOnce(sourceStart, sourceStart + 7 * dayMillis)
        val now = System.currentTimeMillis()
        val copied = sourcePlans.map { plan ->
            val dayOffset = plan.date - sourceStart
            plan.copy(
                id = UUID.randomUUID().toString(),
                date = targetStart + dayOffset,
                isCompleted = false,
                linkedMessageId = null,
                orderNumber = null,
                createdAt = now,
                updatedAt = now
            )
        }
        planDao.upsertAll(copied)
        copied.forEach { syncManager.syncPlan(it) }
        // Copy day categories for the week as well
        dayCategoryRepository.copyWeekDayCategories(sourceStart, targetStart)
    }
}
