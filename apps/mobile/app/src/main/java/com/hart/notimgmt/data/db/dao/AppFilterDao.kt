package com.hart.notimgmt.data.db.dao

import androidx.room.*
import com.hart.notimgmt.data.db.entity.AppFilterEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface AppFilterDao {
    @Query("SELECT * FROM app_filters WHERE isDeleted = 0 ORDER BY appName ASC")
    fun getAll(): Flow<List<AppFilterEntity>>

    @Query("SELECT * FROM app_filters ORDER BY appName ASC")
    suspend fun getAllOnce(): List<AppFilterEntity>

    @Query("SELECT * FROM app_filters WHERE packageName = :packageName AND isDeleted = 0")
    suspend fun getByPackageName(packageName: String): AppFilterEntity?

    @Query("SELECT packageName FROM app_filters WHERE isAllowed = 1 AND isDeleted = 0")
    suspend fun getAllowedPackageNames(): List<String>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(filter: AppFilterEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(filters: List<AppFilterEntity>)

    @Query("UPDATE app_filters SET isDeleted = 1, updatedAt = :updatedAt WHERE packageName = :packageName")
    suspend fun softDelete(packageName: String, updatedAt: Long = System.currentTimeMillis())

    @Delete
    suspend fun delete(filter: AppFilterEntity)

    @Query("SELECT COUNT(*) FROM app_filters WHERE isAllowed = 1 AND isDeleted = 0")
    suspend fun countAllowed(): Int

    @Query("UPDATE app_filters SET isDeleted = 1, updatedAt = :updatedAt WHERE isDeleted = 0")
    suspend fun softDeleteAll(updatedAt: Long = System.currentTimeMillis())

    @Query("DELETE FROM app_filters WHERE isDeleted = 1 AND updatedAt < :beforeTimestamp")
    suspend fun cleanupDeleted(beforeTimestamp: Long)

    @Transaction
    suspend fun replaceAll(filters: List<AppFilterEntity>) {
        softDeleteAll()
        upsertAll(filters)
    }

    @Query("DELETE FROM app_filters")
    suspend fun deleteAll()
}
