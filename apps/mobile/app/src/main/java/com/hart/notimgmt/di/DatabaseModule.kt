package com.hart.notimgmt.di

import android.content.Context
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.hart.notimgmt.data.db.AppDatabase
import com.hart.notimgmt.data.db.dao.*
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import java.util.UUID
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    private val MIGRATION_12_13 = object : Migration(12, 13) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL("ALTER TABLE captured_messages ADD COLUMN senderIcon TEXT")
        }
    }

    private val MIGRATION_13_14 = object : Migration(13, 14) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL("ALTER TABLE captured_messages ADD COLUMN statusHistory TEXT")
        }
    }

    private val MIGRATION_14_15 = object : Migration(14, 15) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL("ALTER TABLE captured_messages ADD COLUMN isPinned INTEGER NOT NULL DEFAULT 0")
            db.execSQL("ALTER TABLE captured_messages ADD COLUMN snoozeAt INTEGER")
        }
    }

    private val MIGRATION_15_16 = object : Migration(15, 16) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL("""CREATE TABLE IF NOT EXISTS plans (
                id TEXT NOT NULL PRIMARY KEY,
                categoryId TEXT,
                date INTEGER NOT NULL,
                title TEXT NOT NULL,
                isCompleted INTEGER NOT NULL DEFAULT 0,
                linkedMessageId TEXT,
                orderNumber TEXT,
                orderIndex INTEGER NOT NULL DEFAULT 0,
                isDeleted INTEGER NOT NULL DEFAULT 0,
                createdAt INTEGER NOT NULL,
                updatedAt INTEGER NOT NULL,
                FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL
            )""")
            db.execSQL("CREATE INDEX IF NOT EXISTS index_plans_categoryId ON plans(categoryId)")
            db.execSQL("CREATE INDEX IF NOT EXISTS index_plans_date ON plans(date)")
        }
    }

    private val MIGRATION_16_17 = object : Migration(16, 17) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL("ALTER TABLE captured_messages ADD COLUMN originalContent TEXT")
        }
    }

    private val MIGRATION_17_18 = object : Migration(17, 18) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL("""CREATE TABLE IF NOT EXISTS day_categories (
                id TEXT NOT NULL PRIMARY KEY,
                date INTEGER NOT NULL,
                categoryId TEXT NOT NULL,
                createdAt INTEGER NOT NULL,
                updatedAt INTEGER NOT NULL,
                FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE CASCADE
            )""")
            db.execSQL("CREATE INDEX IF NOT EXISTS index_day_categories_categoryId ON day_categories(categoryId)")
            db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS index_day_categories_date_categoryId ON day_categories(date, categoryId)")
        }
    }

    private val MIGRATION_18_19 = object : Migration(18, 19) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL("""CREATE TABLE IF NOT EXISTS ai_corrections (
                id TEXT NOT NULL PRIMARY KEY,
                appName TEXT NOT NULL,
                sender TEXT NOT NULL,
                contentSnippet TEXT NOT NULL,
                aiCategoryId TEXT NOT NULL,
                userCategoryId TEXT NOT NULL,
                keywords TEXT,
                createdAt INTEGER NOT NULL,
                FOREIGN KEY (aiCategoryId) REFERENCES categories(id) ON DELETE CASCADE,
                FOREIGN KEY (userCategoryId) REFERENCES categories(id) ON DELETE CASCADE
            )""")
            db.execSQL("CREATE INDEX IF NOT EXISTS index_ai_corrections_aiCategoryId ON ai_corrections(aiCategoryId)")
            db.execSQL("CREATE INDEX IF NOT EXISTS index_ai_corrections_userCategoryId ON ai_corrections(userCategoryId)")
            db.execSQL("CREATE INDEX IF NOT EXISTS index_ai_corrections_createdAt ON ai_corrections(createdAt)")
            db.execSQL("CREATE INDEX IF NOT EXISTS index_ai_corrections_appName ON ai_corrections(appName)")
        }
    }

    private val MIGRATION_19_20 = object : Migration(19, 20) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL("ALTER TABLE filter_rules ADD COLUMN targetAppPackages TEXT NOT NULL DEFAULT '[]'")
        }
    }

    private val MIGRATION_20_21 = object : Migration(20, 21) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL("DROP TABLE IF EXISTS ai_corrections")
        }
    }

    private val MIGRATION_21_22 = object : Migration(21, 22) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL("ALTER TABLE captured_messages ADD COLUMN needsSync INTEGER NOT NULL DEFAULT 0")
        }
    }

    private val MIGRATION_22_23 = object : Migration(22, 23) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL("ALTER TABLE captured_messages ADD COLUMN attachedImage TEXT")
        }
    }

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): AppDatabase =
        Room.databaseBuilder(context, AppDatabase::class.java, "mednoti.db")
            .addMigrations(MIGRATION_12_13, MIGRATION_13_14, MIGRATION_14_15, MIGRATION_15_16, MIGRATION_16_17, MIGRATION_17_18, MIGRATION_18_19, MIGRATION_19_20, MIGRATION_20_21, MIGRATION_21_22, MIGRATION_22_23)
            // v8: UUID 기반 ID 체계로 전환 - 파괴적 마이그레이션 (Firestore 동기화 준비)
            .fallbackToDestructiveMigration()
            .addCallback(object : RoomDatabase.Callback() {
                override fun onCreate(db: SupportSQLiteDatabase) {
                    super.onCreate(db)
                    // Default status steps with UUID
                    val status1Id = UUID.randomUUID().toString()
                    val status2Id = UUID.randomUUID().toString()
                    val status3Id = UUID.randomUUID().toString()
                    val now = System.currentTimeMillis()

                    db.execSQL(
                        "INSERT INTO status_steps (id, name, orderIndex, color, isDeleted, createdAt, updatedAt) VALUES " +
                            "('$status1Id', '미확인', 0, ${0xFF6B7280.toInt()}, 0, $now, $now)"
                    )
                    db.execSQL(
                        "INSERT INTO status_steps (id, name, orderIndex, color, isDeleted, createdAt, updatedAt) VALUES " +
                            "('$status2Id', '확인', 1, ${0xFF3B82F6.toInt()}, 0, $now, $now)"
                    )
                    db.execSQL(
                        "INSERT INTO status_steps (id, name, orderIndex, color, isDeleted, createdAt, updatedAt) VALUES " +
                            "('$status3Id', '완료', 2, ${0xFF10B981.toInt()}, 0, $now, $now)"
                    )

                    // Default app filter: KakaoTalk
                    db.execSQL(
                        "INSERT INTO app_filters (packageName, appName, isAllowed, isDeleted, updatedAt) VALUES " +
                            "('com.kakao.talk', '카카오톡', 1, 0, $now)"
                    )
                }
            })
            .build()

    @Provides
    fun provideCategoryDao(db: AppDatabase): CategoryDao = db.categoryDao()

    @Provides
    fun provideFilterRuleDao(db: AppDatabase): FilterRuleDao = db.filterRuleDao()

    @Provides
    fun provideStatusStepDao(db: AppDatabase): StatusStepDao = db.statusStepDao()

    @Provides
    fun provideCapturedMessageDao(db: AppDatabase): CapturedMessageDao = db.capturedMessageDao()

    @Provides
    fun provideAppFilterDao(db: AppDatabase): AppFilterDao = db.appFilterDao()

    @Provides
    fun providePlanDao(db: AppDatabase): PlanDao = db.planDao()

    @Provides
    fun provideDayCategoryDao(db: AppDatabase): DayCategoryDao = db.dayCategoryDao()

}
