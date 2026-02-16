package com.hart.notimgmt.data.repository

import com.hart.notimgmt.data.db.dao.StatusStepDao
import com.hart.notimgmt.data.db.entity.StatusStepEntity
import com.hart.notimgmt.data.sync.SyncManager
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class StatusStepRepository @Inject constructor(
    private val statusStepDao: StatusStepDao,
    private val syncManager: SyncManager
) {
    fun getAll(): Flow<List<StatusStepEntity>> = statusStepDao.getAll()

    suspend fun getAllOnce(): List<StatusStepEntity> = statusStepDao.getAllOnce().filter { !it.isDeleted }

    suspend fun getFirstStep(): StatusStepEntity? = statusStepDao.getFirstStep()

    suspend fun getById(id: String): StatusStepEntity? = statusStepDao.getById(id)

    suspend fun getMaxOrderIndex(): Int = statusStepDao.getMaxOrderIndex()

    suspend fun insert(step: StatusStepEntity): String {
        val entity = step.copy(updatedAt = System.currentTimeMillis())
        statusStepDao.upsert(entity)
        syncManager.syncStatusStep(entity)
        return entity.id
    }

    suspend fun insertAll(steps: List<StatusStepEntity>) {
        val now = System.currentTimeMillis()
        val entities = steps.map { it.copy(updatedAt = now) }
        statusStepDao.upsertAll(entities)
        entities.forEach { syncManager.syncStatusStep(it) }
    }

    suspend fun update(step: StatusStepEntity) {
        val entity = step.copy(updatedAt = System.currentTimeMillis())
        statusStepDao.update(entity)
        syncManager.syncStatusStep(entity)
    }

    suspend fun updateAll(steps: List<StatusStepEntity>) {
        val now = System.currentTimeMillis()
        val entities = steps.map { it.copy(updatedAt = now) }
        statusStepDao.updateAll(entities)
        entities.forEach { syncManager.syncStatusStep(it) }
    }

    suspend fun delete(step: StatusStepEntity) {
        val entity = step.copy(isDeleted = true, updatedAt = System.currentTimeMillis())
        statusStepDao.update(entity)
        syncManager.syncStatusStep(entity)
    }

    suspend fun count(): Int = statusStepDao.count()
}
