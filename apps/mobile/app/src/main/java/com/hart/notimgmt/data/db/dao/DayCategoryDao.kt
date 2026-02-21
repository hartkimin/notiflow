package com.hart.notimgmt.data.db.dao

import androidx.room.*
import com.hart.notimgmt.data.db.entity.DayCategoryEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface DayCategoryDao {
    @Query("SELECT * FROM day_categories WHERE date = :date")
    fun getByDate(date: Long): Flow<List<DayCategoryEntity>>

    @Query("SELECT * FROM day_categories WHERE date >= :startDate AND date < :endDate")
    fun getByDateRange(startDate: Long, endDate: Long): Flow<List<DayCategoryEntity>>

    @Query("SELECT * FROM day_categories WHERE date >= :startDate AND date < :endDate")
    suspend fun getByDateRangeOnce(startDate: Long, endDate: Long): List<DayCategoryEntity>

    @Query("SELECT * FROM day_categories")
    suspend fun getAllOnce(): List<DayCategoryEntity>

    @Query("SELECT * FROM day_categories WHERE id = :id")
    suspend fun getById(id: String): DayCategoryEntity?

    @Query("SELECT categoryId FROM day_categories WHERE date = :date")
    suspend fun getCategoryIdsByDate(date: Long): List<String>

    @Query("SELECT * FROM day_categories WHERE date = :date AND categoryId = :categoryId LIMIT 1")
    suspend fun getByDateAndCategory(date: Long, categoryId: String): DayCategoryEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: DayCategoryEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entities: List<DayCategoryEntity>)

    @Query("DELETE FROM day_categories WHERE date = :date AND categoryId = :categoryId")
    suspend fun delete(date: Long, categoryId: String)

    @Query("DELETE FROM day_categories WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM day_categories")
    suspend fun deleteAll()
}
