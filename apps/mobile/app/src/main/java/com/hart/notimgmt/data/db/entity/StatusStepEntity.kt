package com.hart.notimgmt.data.db.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.UUID

@Entity(tableName = "status_steps")
data class StatusStepEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val name: String,
    val orderIndex: Int,
    val color: Int,
    val isDeleted: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)
