package com.hart.notimgmt.data.db.dao

import androidx.room.*
import com.hart.notimgmt.data.db.entity.StatusStepEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface StatusStepDao {
    @Query("SELECT * FROM status_steps WHERE isDeleted = 0 ORDER BY orderIndex ASC")
    fun getAll(): Flow<List<StatusStepEntity>>

    @Query("SELECT * FROM status_steps ORDER BY orderIndex ASC")
    suspend fun getAllOnce(): List<StatusStepEntity>

    @Query("SELECT * FROM status_steps WHERE isDeleted = 0 ORDER BY orderIndex ASC LIMIT 1")
    suspend fun getFirstStep(): StatusStepEntity?

    @Query("SELECT * FROM status_steps WHERE isDeleted = 0 ORDER BY orderIndex DESC LIMIT 1")
    suspend fun getLastStep(): StatusStepEntity?

    @Query("SELECT * FROM status_steps WHERE id = :id")
    suspend fun getById(id: String): StatusStepEntity?

    @Query("SELECT COALESCE(MAX(orderIndex), -1) FROM status_steps WHERE isDeleted = 0")
    suspend fun getMaxOrderIndex(): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(step: StatusStepEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(steps: List<StatusStepEntity>)

    @Update
    suspend fun update(step: StatusStepEntity)

    @Update
    suspend fun updateAll(steps: List<StatusStepEntity>)

    @Query("UPDATE status_steps SET isDeleted = 1, updatedAt = :updatedAt WHERE id = :id")
    suspend fun softDelete(id: String, updatedAt: Long = System.currentTimeMillis())

    @Delete
    suspend fun delete(step: StatusStepEntity)

    @Query("SELECT COUNT(*) FROM status_steps WHERE isDeleted = 0")
    suspend fun count(): Int

    @Query("DELETE FROM status_steps WHERE isDeleted = 1 AND updatedAt < :beforeTimestamp")
    suspend fun cleanupDeleted(beforeTimestamp: Long)

    @Query("DELETE FROM status_steps")
    suspend fun deleteAll()
}
