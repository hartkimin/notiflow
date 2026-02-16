package com.hart.notimgmt.data.db.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import com.hart.notimgmt.data.model.ConditionType
import com.hart.notimgmt.data.model.KeywordItem
import com.hart.notimgmt.data.model.KeywordMatchType
import com.hart.notimgmt.data.model.SenderMatchType
import java.util.UUID

@Entity(
    tableName = "filter_rules",
    foreignKeys = [
        ForeignKey(
            entity = CategoryEntity::class,
            parentColumns = ["id"],
            childColumns = ["categoryId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("categoryId")]
)
data class FilterRuleEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val categoryId: String,
    val senderKeywords: List<KeywordItem> = emptyList(),
    val includeWords: List<KeywordItem> = emptyList(),
    val conditionType: ConditionType = ConditionType.AND,
    val targetAppPackages: List<String> = emptyList(),
    // Deprecated fields (kept for backward compatibility)
    @Deprecated("No longer used") val senderMatchType: SenderMatchType = SenderMatchType.CONTAINS,
    @Deprecated("No longer used") val smsPhoneNumber: String? = null,
    @Deprecated("No longer used") val excludeWords: List<String> = emptyList(),
    @Deprecated("No longer used") val includeMatchType: KeywordMatchType = KeywordMatchType.OR,
    val isActive: Boolean = true,
    val isDeleted: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)
