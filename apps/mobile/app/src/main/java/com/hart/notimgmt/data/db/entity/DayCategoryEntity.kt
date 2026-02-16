package com.hart.notimgmt.data.db.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.ForeignKey.Companion.CASCADE
import androidx.room.Index
import androidx.room.PrimaryKey
import java.util.UUID

@Entity(
    tableName = "day_categories",
    foreignKeys = [
        ForeignKey(
            entity = CategoryEntity::class,
            parentColumns = ["id"],
            childColumns = ["categoryId"],
            onDelete = CASCADE
        )
    ],
    indices = [
        Index("categoryId"),
        Index(value = ["date", "categoryId"], unique = true)
    ]
)
data class DayCategoryEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val date: Long,
    val categoryId: String,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)
