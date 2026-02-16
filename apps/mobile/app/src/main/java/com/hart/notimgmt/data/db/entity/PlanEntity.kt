package com.hart.notimgmt.data.db.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.ForeignKey.Companion.SET_NULL
import androidx.room.Index
import androidx.room.PrimaryKey
import java.util.UUID

@Entity(
    tableName = "plans",
    foreignKeys = [
        ForeignKey(
            entity = CategoryEntity::class,
            parentColumns = ["id"],
            childColumns = ["categoryId"],
            onDelete = SET_NULL
        )
    ],
    indices = [Index("categoryId"), Index("date")]
)
data class PlanEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val categoryId: String?,
    val date: Long,
    val title: String,
    val isCompleted: Boolean = false,
    val linkedMessageId: String? = null,
    val orderNumber: String? = null,
    val orderIndex: Int = 0,
    val isDeleted: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)
