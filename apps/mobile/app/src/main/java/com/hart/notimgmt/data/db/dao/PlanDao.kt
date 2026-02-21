package com.hart.notimgmt.data.db.dao

import androidx.room.*
import com.hart.notimgmt.data.db.entity.PlanEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface PlanDao {
    @Query("SELECT * FROM plans WHERE date = :date AND isDeleted = 0 ORDER BY orderIndex ASC")
    fun getByDate(date: Long): Flow<List<PlanEntity>>

    @Query("SELECT * FROM plans WHERE date >= :startDate AND date < :endDate AND isDeleted = 0 ORDER BY date ASC, orderIndex ASC")
    fun getByDateRange(startDate: Long, endDate: Long): Flow<List<PlanEntity>>

    @Query("SELECT * FROM plans WHERE date >= :startDate AND date < :endDate AND isDeleted = 0 ORDER BY date ASC, orderIndex ASC")
    suspend fun getByDateRangeOnce(startDate: Long, endDate: Long): List<PlanEntity>

    @Query("SELECT * FROM plans WHERE id = :id")
    suspend fun getById(id: String): PlanEntity?

    @Query("SELECT * FROM plans ORDER BY date ASC, orderIndex ASC")
    suspend fun getAllOnce(): List<PlanEntity>

    @Query("SELECT COALESCE(MAX(orderIndex), -1) FROM plans WHERE date = :date AND categoryId = :categoryId AND isDeleted = 0")
    suspend fun getMaxOrderIndex(date: Long, categoryId: String?): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(plan: PlanEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(plans: List<PlanEntity>)

    @Update
    suspend fun update(plan: PlanEntity)

    @Query("UPDATE plans SET isCompleted = :isCompleted, updatedAt = :updatedAt WHERE id = :id")
    suspend fun updateCompletion(id: String, isCompleted: Boolean, updatedAt: Long = System.currentTimeMillis())

    @Query("UPDATE plans SET isDeleted = 1, updatedAt = :updatedAt WHERE id = :id")
    suspend fun softDelete(id: String, updatedAt: Long = System.currentTimeMillis())

    @Query("DELETE FROM plans WHERE isDeleted = 1 AND updatedAt < :beforeTimestamp")
    suspend fun cleanupDeleted(beforeTimestamp: Long)

    @Query("DELETE FROM plans")
    suspend fun deleteAll()
}
