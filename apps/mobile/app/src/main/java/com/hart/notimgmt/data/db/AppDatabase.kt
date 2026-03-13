package com.hart.notimgmt.data.db

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.hart.notimgmt.data.db.dao.*
import com.hart.notimgmt.data.db.entity.*

@Database(
    entities = [
        CategoryEntity::class,
        FilterRuleEntity::class,
        StatusStepEntity::class,
        CapturedMessageEntity::class,
        AppFilterEntity::class,
        PlanEntity::class,
        DayCategoryEntity::class
    ],
    version = 27,
    exportSchema = true
)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun categoryDao(): CategoryDao
    abstract fun filterRuleDao(): FilterRuleDao
    abstract fun statusStepDao(): StatusStepDao
    abstract fun capturedMessageDao(): CapturedMessageDao
    abstract fun appFilterDao(): AppFilterDao
    abstract fun planDao(): PlanDao
    abstract fun dayCategoryDao(): DayCategoryDao
}
