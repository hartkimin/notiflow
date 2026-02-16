package com.hart.notimgmt.data.repository

import com.hart.notimgmt.data.db.dao.DayCategoryDao
import com.hart.notimgmt.data.db.entity.DayCategoryEntity
import com.hart.notimgmt.data.sync.SyncManager
import kotlinx.coroutines.flow.Flow
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DayCategoryRepository @Inject constructor(
    private val dayCategoryDao: DayCategoryDao,
    private val syncManager: SyncManager
) {
    fun getByDate(date: Long): Flow<List<DayCategoryEntity>> = dayCategoryDao.getByDate(date)

    fun getByDateRange(startDate: Long, endDate: Long): Flow<List<DayCategoryEntity>> =
        dayCategoryDao.getByDateRange(startDate, endDate)

    suspend fun addCategoryToDay(date: Long, categoryId: String) {
        val entity = DayCategoryEntity(
            date = date,
            categoryId = categoryId
        )
        dayCategoryDao.upsert(entity)
        syncManager.syncDayCategory(entity)
    }

    suspend fun removeCategoryFromDay(date: Long, categoryId: String) {
        val entity = dayCategoryDao.getByDateAndCategory(date, categoryId) ?: return
        dayCategoryDao.delete(date, categoryId)
        syncManager.deleteDayCategory(entity.id)
    }

    suspend fun addAllCategoriesToWeek(weekStartMillis: Long, categoryIds: List<String>) {
        val dayMillis = 24 * 60 * 60 * 1000L
        val weekEnd = weekStartMillis + 7 * dayMillis
        // 이미 존재하는 (date, categoryId) 쌍은 건너뛰어 기존 ID/sync 보존
        val existing = dayCategoryDao.getByDateRangeOnce(weekStartMillis, weekEnd)
        val existingKeys = existing.map { "${it.date}|${it.categoryId}" }.toSet()
        val now = System.currentTimeMillis()
        val newEntities = (0 until 7).flatMap { dayOffset ->
            val date = weekStartMillis + dayOffset * dayMillis
            categoryIds.mapNotNull { categoryId ->
                if ("$date|$categoryId" in existingKeys) null
                else DayCategoryEntity(
                    date = date,
                    categoryId = categoryId,
                    createdAt = now,
                    updatedAt = now
                )
            }
        }
        if (newEntities.isEmpty()) return
        dayCategoryDao.upsertAll(newEntities)
        newEntities.forEach { syncManager.syncDayCategory(it) }
    }

    suspend fun copyWeekDayCategories(sourceStart: Long, targetStart: Long) {
        val dayMillis = 24 * 60 * 60 * 1000L
        val sourceEntities = dayCategoryDao.getByDateRangeOnce(sourceStart, sourceStart + 7 * dayMillis)
        val now = System.currentTimeMillis()
        val copied = sourceEntities.map { entity ->
            val dayOffset = entity.date - sourceStart
            entity.copy(
                id = UUID.randomUUID().toString(),
                date = targetStart + dayOffset,
                createdAt = now,
                updatedAt = now
            )
        }
        dayCategoryDao.upsertAll(copied)
        copied.forEach { syncManager.syncDayCategory(it) }
    }
}
