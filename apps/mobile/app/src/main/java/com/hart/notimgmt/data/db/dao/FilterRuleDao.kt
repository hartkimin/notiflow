package com.hart.notimgmt.data.db.dao

import androidx.room.*
import com.hart.notimgmt.data.db.entity.FilterRuleEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface FilterRuleDao {
    @Query("SELECT * FROM filter_rules WHERE isDeleted = 0 ORDER BY createdAt DESC")
    fun getAll(): Flow<List<FilterRuleEntity>>

    @Query("SELECT * FROM filter_rules ORDER BY createdAt DESC")
    suspend fun getAllOnce(): List<FilterRuleEntity>

    @Query("SELECT * FROM filter_rules WHERE categoryId = :categoryId AND isDeleted = 0 ORDER BY createdAt DESC")
    fun getByCategoryId(categoryId: String): Flow<List<FilterRuleEntity>>

    @Query("SELECT * FROM filter_rules WHERE categoryId = :categoryId AND isDeleted = 0 ORDER BY createdAt DESC")
    suspend fun getByCategoryIdOnce(categoryId: String): List<FilterRuleEntity>

    @Query("""
        SELECT fr.* FROM filter_rules fr
        INNER JOIN categories c ON fr.categoryId = c.id
        WHERE fr.isActive = 1 AND fr.isDeleted = 0
        AND c.isActive = 1 AND c.isDeleted = 0
    """)
    suspend fun getActiveRules(): List<FilterRuleEntity>

    @Query("SELECT * FROM filter_rules WHERE id = :id")
    suspend fun getById(id: String): FilterRuleEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(rule: FilterRuleEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(rules: List<FilterRuleEntity>)

    @Update
    suspend fun update(rule: FilterRuleEntity)

    @Query("UPDATE filter_rules SET isDeleted = 1, updatedAt = :updatedAt WHERE id = :id")
    suspend fun softDelete(id: String, updatedAt: Long = System.currentTimeMillis())

    @Delete
    suspend fun delete(rule: FilterRuleEntity)

    @Query("DELETE FROM filter_rules WHERE isDeleted = 1 AND updatedAt < :beforeTimestamp")
    suspend fun cleanupDeleted(beforeTimestamp: Long)
}
