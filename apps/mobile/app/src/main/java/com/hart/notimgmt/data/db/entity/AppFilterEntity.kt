package com.hart.notimgmt.data.db.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "app_filters")
data class AppFilterEntity(
    @PrimaryKey val packageName: String,
    val appName: String,
    val isAllowed: Boolean = true,
    val isDeleted: Boolean = false,
    val updatedAt: Long = System.currentTimeMillis()
)
