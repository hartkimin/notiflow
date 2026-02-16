package com.hart.notimgmt.data.db.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import java.util.UUID

@Entity(
    tableName = "captured_messages",
    foreignKeys = [
        ForeignKey(
            entity = CategoryEntity::class,
            parentColumns = ["id"],
            childColumns = ["categoryId"],
            onDelete = ForeignKey.SET_NULL
        ),
        ForeignKey(
            entity = FilterRuleEntity::class,
            parentColumns = ["id"],
            childColumns = ["matchedRuleId"],
            onDelete = ForeignKey.SET_NULL
        ),
        ForeignKey(
            entity = StatusStepEntity::class,
            parentColumns = ["id"],
            childColumns = ["statusId"],
            onDelete = ForeignKey.SET_NULL
        )
    ],
    indices = [Index("categoryId"), Index("matchedRuleId"), Index("statusId"), Index("receivedAt")]
)
data class CapturedMessageEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val categoryId: String?,
    val matchedRuleId: String?,
    val source: String,
    val appName: String,
    val sender: String,
    val content: String,
    val statusId: String?,
    val comment: String? = null,
    val senderIcon: String? = null,
    val isArchived: Boolean = false,
    val isDeleted: Boolean = false,
    val receivedAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val statusChangedAt: Long? = null,
    val statusHistory: String? = null,
    val isPinned: Boolean = false,
    val snoozeAt: Long? = null,
    val originalContent: String? = null
)
