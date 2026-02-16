package com.hart.notimgmt.data.repository

import com.hart.notimgmt.data.db.dao.AppFilterDao
import com.hart.notimgmt.data.db.entity.AppFilterEntity
import com.hart.notimgmt.data.sync.SyncManager
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AppFilterRepository @Inject constructor(
    private val appFilterDao: AppFilterDao,
    private val syncManager: SyncManager
) {
    fun getAll(): Flow<List<AppFilterEntity>> = appFilterDao.getAll()

    suspend fun getByPackageName(packageName: String): AppFilterEntity? =
        appFilterDao.getByPackageName(packageName)

    suspend fun getAllowedPackageNames(): List<String> =
        appFilterDao.getAllowedPackageNames()

    suspend fun countAllowed(): Int = appFilterDao.countAllowed()

    suspend fun upsert(filter: AppFilterEntity) {
        val entity = filter.copy(updatedAt = System.currentTimeMillis())
        appFilterDao.upsert(entity)
        syncManager.syncAppFilter(entity)
    }

    suspend fun upsertAll(filters: List<AppFilterEntity>) {
        val now = System.currentTimeMillis()
        val entities = filters.map { it.copy(updatedAt = now) }
        appFilterDao.upsertAll(entities)
        entities.forEach { syncManager.syncAppFilter(it) }
    }

    suspend fun delete(filter: AppFilterEntity) {
        val entity = filter.copy(isDeleted = true, updatedAt = System.currentTimeMillis())
        appFilterDao.upsert(entity)
        syncManager.syncAppFilter(entity)
    }

    suspend fun softDeleteAll() {
        // Get all filters before soft deleting
        val allFilters = appFilterDao.getAllowedPackageNames()
        appFilterDao.softDeleteAll()
        // Sync all as deleted
        allFilters.forEach { packageName ->
            appFilterDao.getByPackageName(packageName)?.let {
                syncManager.syncAppFilter(it)
            }
        }
    }

    suspend fun replaceAll(filters: List<AppFilterEntity>) {
        softDeleteAll()
        upsertAll(filters)
    }
}
