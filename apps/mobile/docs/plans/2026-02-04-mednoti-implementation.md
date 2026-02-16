# MedNotiV2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 카카오톡/SMS에서 수신되는 업무 메시지를 자동 선별하고, 다단계 상태를 추적하며, 캘린더에서 현황을 확인하는 Android 앱 구현

**Architecture:** MVVM + Clean Architecture (간소화). NotificationListenerService로 알림 수집, Room DB로 로컬 저장, Jetpack Compose + Material3 UI, Hilt DI

**Tech Stack:** Kotlin 2.0.21, Jetpack Compose (BOM 2024.09.00), Room 2.6.1, Hilt 2.51.1, Navigation Compose 2.8.4, KSP

---

### Task 1: Gradle 의존성 설정

**Files:**
- Modify: `gradle/libs.versions.toml`
- Modify: `build.gradle.kts` (root)
- Modify: `app/build.gradle.kts`
- Modify: `settings.gradle.kts`

**Step 1: libs.versions.toml에 버전 및 라이브러리 추가**

`gradle/libs.versions.toml` 파일의 `[versions]` 섹션 끝에 추가:
```toml
room = "2.6.1"
hilt = "2.51.1"
ksp = "2.0.21-1.0.28"
navigationCompose = "2.8.4"
hiltNavigationCompose = "1.2.0"
lifecycleViewmodelCompose = "2.8.7"
material3 = "1.3.1"
materialIconsExtended = "1.7.6"
```

`[libraries]` 섹션 끝에 추가:
```toml
# Room
androidx-room-runtime = { group = "androidx.room", name = "room-runtime", version.ref = "room" }
androidx-room-ktx = { group = "androidx.room", name = "room-ktx", version.ref = "room" }
androidx-room-compiler = { group = "androidx.room", name = "room-compiler", version.ref = "room" }

# Hilt
hilt-android = { group = "com.google.dagger", name = "hilt-android", version.ref = "hilt" }
hilt-compiler = { group = "com.google.dagger", name = "hilt-compiler", version.ref = "hilt" }
androidx-hilt-navigation-compose = { group = "androidx.hilt", name = "hilt-navigation-compose", version.ref = "hiltNavigationCompose" }

# Navigation
androidx-navigation-compose = { group = "androidx.navigation", name = "navigation-compose", version.ref = "navigationCompose" }

# Lifecycle ViewModel Compose
androidx-lifecycle-viewmodel-compose = { group = "androidx.lifecycle", name = "lifecycle-viewmodel-compose", version.ref = "lifecycleViewmodelCompose" }

# Material Icons Extended
androidx-material-icons-extended = { group = "androidx.compose.material", name = "material-icons-extended" }
```

`[plugins]` 섹션 끝에 추가:
```toml
hilt-android = { id = "com.google.dagger.hilt.android", version.ref = "hilt" }
ksp = { id = "com.google.devtools.ksp", version.ref = "ksp" }
```

**Step 2: root build.gradle.kts에 플러그인 추가**

`build.gradle.kts` (root) plugins 블록에 추가:
```kotlin
alias(libs.plugins.hilt.android) apply false
alias(libs.plugins.ksp) apply false
```

**Step 3: app/build.gradle.kts에 플러그인 및 의존성 추가**

plugins 블록에 추가:
```kotlin
alias(libs.plugins.hilt.android)
alias(libs.plugins.ksp)
```

dependencies 블록에 추가:
```kotlin
// Room
implementation(libs.androidx.room.runtime)
implementation(libs.androidx.room.ktx)
ksp(libs.androidx.room.compiler)

// Hilt
implementation(libs.hilt.android)
ksp(libs.hilt.compiler)
implementation(libs.androidx.hilt.navigation.compose)

// Navigation
implementation(libs.androidx.navigation.compose)

// ViewModel Compose
implementation(libs.androidx.lifecycle.viewmodel.compose)

// Material Icons Extended
implementation(libs.androidx.material.icons.extended)
```

**Step 4: Gradle Sync 확인**

Run: `cd /mnt/c/AndroidStudio/MedNotiV2 && ./gradlew :app:dependencies --configuration debugCompileClasspath 2>&1 | head -50`
Expected: 의존성 목록에 room, hilt, navigation이 포함됨

**Step 5: 빌드 확인**

Run: `cd /mnt/c/AndroidStudio/MedNotiV2 && ./gradlew :app:compileDebugKotlin`
Expected: BUILD SUCCESSFUL

**Step 6: Commit**

```bash
git add gradle/libs.versions.toml build.gradle.kts app/build.gradle.kts
git commit -m "feat: add Room, Hilt, Navigation Compose dependencies"
```

---

### Task 2: Hilt Application 클래스 + 기본 패키지 구조

**Files:**
- Create: `app/src/main/java/com/nopti/mednotiv2/MedNotiApp.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/MainActivity.kt`
- Modify: `app/src/main/AndroidManifest.xml`

**Step 1: Application 클래스 생성**

`MedNotiApp.kt`:
```kotlin
package com.nopti.mednotiv2

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class MedNotiApp : Application()
```

**Step 2: AndroidManifest.xml에 Application 등록**

`<application` 태그에 `android:name=".MedNotiApp"` 속성 추가.

**Step 3: MainActivity에 @AndroidEntryPoint 추가**

```kotlin
package com.nopti.mednotiv2

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Scaffold
import androidx.compose.ui.Modifier
import com.nopti.mednotiv2.ui.theme.MedNotiV2Theme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MedNotiV2Theme {
                Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
                    // Navigation will be added in Task 7
                }
            }
        }
    }
}
```

**Step 4: 빌드 확인**

Run: `cd /mnt/c/AndroidStudio/MedNotiV2 && ./gradlew :app:compileDebugKotlin`
Expected: BUILD SUCCESSFUL

**Step 5: Commit**

```bash
git add app/src/main/java/com/nopti/mednotiv2/MedNotiApp.kt \
  app/src/main/java/com/nopti/mednotiv2/MainActivity.kt \
  app/src/main/AndroidManifest.xml
git commit -m "feat: add Hilt Application class and AndroidEntryPoint"
```

---

### Task 3: Room 데이터 모델 (Entity + Enum + TypeConverter)

**Files:**
- Create: `app/src/main/java/com/nopti/mednotiv2/data/model/MessageSource.kt`
- Create: `app/src/main/java/com/nopti/mednotiv2/data/db/entity/CategoryEntity.kt`
- Create: `app/src/main/java/com/nopti/mednotiv2/data/db/entity/FilterRuleEntity.kt`
- Create: `app/src/main/java/com/nopti/mednotiv2/data/db/entity/StatusStepEntity.kt`
- Create: `app/src/main/java/com/nopti/mednotiv2/data/db/entity/CapturedMessageEntity.kt`
- Create: `app/src/main/java/com/nopti/mednotiv2/data/db/Converters.kt`

**Step 1: MessageSource enum 생성**

`data/model/MessageSource.kt`:
```kotlin
package com.nopti.mednotiv2.data.model

enum class MessageSource {
    KAKAO, SMS, ALL
}
```

**Step 2: CategoryEntity 생성**

`data/db/entity/CategoryEntity.kt`:
```kotlin
package com.nopti.mednotiv2.data.db.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "categories")
data class CategoryEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val color: Int,
    val createdAt: Long = System.currentTimeMillis()
)
```

**Step 3: FilterRuleEntity 생성**

`data/db/entity/FilterRuleEntity.kt`:
```kotlin
package com.nopti.mednotiv2.data.db.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import com.nopti.mednotiv2.data.model.MessageSource

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
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val categoryId: Long,
    val source: MessageSource,
    val senderKeyword: String?,
    val includeWords: List<String>,
    val excludeWords: List<String>,
    val isActive: Boolean = true,
    val createdAt: Long = System.currentTimeMillis()
)
```

**Step 4: StatusStepEntity 생성**

`data/db/entity/StatusStepEntity.kt`:
```kotlin
package com.nopti.mednotiv2.data.db.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "status_steps",
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
data class StatusStepEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val categoryId: Long,
    val name: String,
    val orderIndex: Int,
    val color: Int
)
```

**Step 5: CapturedMessageEntity 생성**

`data/db/entity/CapturedMessageEntity.kt`:
```kotlin
package com.nopti.mednotiv2.data.db.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import com.nopti.mednotiv2.data.model.MessageSource

@Entity(
    tableName = "captured_messages",
    foreignKeys = [
        ForeignKey(
            entity = CategoryEntity::class,
            parentColumns = ["id"],
            childColumns = ["categoryId"],
            onDelete = ForeignKey.CASCADE
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
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val categoryId: Long,
    val matchedRuleId: Long?,
    val source: MessageSource,
    val sender: String,
    val content: String,
    val statusId: Long?,
    val receivedAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)
```

**Step 6: TypeConverter 생성**

`data/db/Converters.kt`:
```kotlin
package com.nopti.mednotiv2.data.db

import androidx.room.TypeConverter
import com.nopti.mednotiv2.data.model.MessageSource

class Converters {
    @TypeConverter
    fun fromStringList(value: List<String>): String = value.joinToString(separator = "|||")

    @TypeConverter
    fun toStringList(value: String): List<String> =
        if (value.isEmpty()) emptyList() else value.split("|||")

    @TypeConverter
    fun fromMessageSource(value: MessageSource): String = value.name

    @TypeConverter
    fun toMessageSource(value: String): MessageSource = MessageSource.valueOf(value)
}
```

**Step 7: 빌드 확인**

Run: `cd /mnt/c/AndroidStudio/MedNotiV2 && ./gradlew :app:compileDebugKotlin`
Expected: BUILD SUCCESSFUL

**Step 8: Commit**

```bash
git add app/src/main/java/com/nopti/mednotiv2/data/
git commit -m "feat: add Room entities, enums, and type converters"
```

---

### Task 4: Room DAO 인터페이스

**Files:**
- Create: `app/src/main/java/com/nopti/mednotiv2/data/db/dao/CategoryDao.kt`
- Create: `app/src/main/java/com/nopti/mednotiv2/data/db/dao/FilterRuleDao.kt`
- Create: `app/src/main/java/com/nopti/mednotiv2/data/db/dao/StatusStepDao.kt`
- Create: `app/src/main/java/com/nopti/mednotiv2/data/db/dao/CapturedMessageDao.kt`

**Step 1: CategoryDao 생성**

`data/db/dao/CategoryDao.kt`:
```kotlin
package com.nopti.mednotiv2.data.db.dao

import androidx.room.*
import com.nopti.mednotiv2.data.db.entity.CategoryEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface CategoryDao {
    @Query("SELECT * FROM categories ORDER BY createdAt DESC")
    fun getAll(): Flow<List<CategoryEntity>>

    @Query("SELECT * FROM categories WHERE id = :id")
    suspend fun getById(id: Long): CategoryEntity?

    @Insert
    suspend fun insert(category: CategoryEntity): Long

    @Update
    suspend fun update(category: CategoryEntity)

    @Delete
    suspend fun delete(category: CategoryEntity)
}
```

**Step 2: FilterRuleDao 생성**

`data/db/dao/FilterRuleDao.kt`:
```kotlin
package com.nopti.mednotiv2.data.db.dao

import androidx.room.*
import com.nopti.mednotiv2.data.db.entity.FilterRuleEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface FilterRuleDao {
    @Query("SELECT * FROM filter_rules WHERE categoryId = :categoryId ORDER BY createdAt DESC")
    fun getByCategoryId(categoryId: Long): Flow<List<FilterRuleEntity>>

    @Query("SELECT * FROM filter_rules WHERE isActive = 1")
    suspend fun getActiveRules(): List<FilterRuleEntity>

    @Query("SELECT * FROM filter_rules WHERE id = :id")
    suspend fun getById(id: Long): FilterRuleEntity?

    @Insert
    suspend fun insert(rule: FilterRuleEntity): Long

    @Update
    suspend fun update(rule: FilterRuleEntity)

    @Delete
    suspend fun delete(rule: FilterRuleEntity)
}
```

**Step 3: StatusStepDao 생성**

`data/db/dao/StatusStepDao.kt`:
```kotlin
package com.nopti.mednotiv2.data.db.dao

import androidx.room.*
import com.nopti.mednotiv2.data.db.entity.StatusStepEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface StatusStepDao {
    @Query("SELECT * FROM status_steps WHERE categoryId = :categoryId ORDER BY orderIndex ASC")
    fun getByCategoryId(categoryId: Long): Flow<List<StatusStepEntity>>

    @Query("SELECT * FROM status_steps WHERE categoryId = :categoryId ORDER BY orderIndex ASC LIMIT 1")
    suspend fun getFirstStep(categoryId: Long): StatusStepEntity?

    @Query("SELECT * FROM status_steps WHERE id = :id")
    suspend fun getById(id: Long): StatusStepEntity?

    @Insert
    suspend fun insert(step: StatusStepEntity): Long

    @Update
    suspend fun update(step: StatusStepEntity)

    @Update
    suspend fun updateAll(steps: List<StatusStepEntity>)

    @Delete
    suspend fun delete(step: StatusStepEntity)
}
```

**Step 4: CapturedMessageDao 생성**

`data/db/dao/CapturedMessageDao.kt`:
```kotlin
package com.nopti.mednotiv2.data.db.dao

import androidx.room.*
import com.nopti.mednotiv2.data.db.entity.CapturedMessageEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface CapturedMessageDao {
    @Query("SELECT * FROM captured_messages ORDER BY receivedAt DESC")
    fun getAll(): Flow<List<CapturedMessageEntity>>

    @Query("SELECT * FROM captured_messages WHERE categoryId = :categoryId ORDER BY receivedAt DESC")
    fun getByCategoryId(categoryId: Long): Flow<List<CapturedMessageEntity>>

    @Query("SELECT * FROM captured_messages WHERE receivedAt BETWEEN :startOfDay AND :endOfDay ORDER BY receivedAt DESC")
    fun getByDateRange(startOfDay: Long, endOfDay: Long): Flow<List<CapturedMessageEntity>>

    @Query("SELECT * FROM captured_messages WHERE id = :id")
    suspend fun getById(id: Long): CapturedMessageEntity?

    @Query("""
        SELECT statusId, COUNT(*) as count
        FROM captured_messages
        WHERE receivedAt BETWEEN :startOfDay AND :endOfDay
        GROUP BY statusId
    """)
    fun getStatusCountsByDateRange(startOfDay: Long, endOfDay: Long): Flow<List<StatusCount>>

    @Query("""
        SELECT DISTINCT receivedAt / 86400000 as dayEpoch, categoryId
        FROM captured_messages
        WHERE receivedAt BETWEEN :monthStart AND :monthEnd
    """)
    fun getMessageDaysInMonth(monthStart: Long, monthEnd: Long): Flow<List<DayCategory>>

    @Insert
    suspend fun insert(message: CapturedMessageEntity): Long

    @Update
    suspend fun update(message: CapturedMessageEntity)

    @Delete
    suspend fun delete(message: CapturedMessageEntity)

    @Query("UPDATE captured_messages SET statusId = :statusId, updatedAt = :updatedAt WHERE id = :messageId")
    suspend fun updateStatus(messageId: Long, statusId: Long, updatedAt: Long = System.currentTimeMillis())
}

data class StatusCount(val statusId: Long?, val count: Int)
data class DayCategory(val dayEpoch: Long, val categoryId: Long)
```

**Step 5: 빌드 확인**

Run: `cd /mnt/c/AndroidStudio/MedNotiV2 && ./gradlew :app:compileDebugKotlin`
Expected: BUILD SUCCESSFUL

**Step 6: Commit**

```bash
git add app/src/main/java/com/nopti/mednotiv2/data/db/dao/
git commit -m "feat: add Room DAO interfaces for all entities"
```

---

### Task 5: Room Database + Hilt DI 모듈

**Files:**
- Create: `app/src/main/java/com/nopti/mednotiv2/data/db/AppDatabase.kt`
- Create: `app/src/main/java/com/nopti/mednotiv2/di/DatabaseModule.kt`

**Step 1: AppDatabase 생성**

`data/db/AppDatabase.kt`:
```kotlin
package com.nopti.mednotiv2.data.db

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.nopti.mednotiv2.data.db.dao.*
import com.nopti.mednotiv2.data.db.entity.*

@Database(
    entities = [
        CategoryEntity::class,
        FilterRuleEntity::class,
        StatusStepEntity::class,
        CapturedMessageEntity::class
    ],
    version = 1,
    exportSchema = false
)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun categoryDao(): CategoryDao
    abstract fun filterRuleDao(): FilterRuleDao
    abstract fun statusStepDao(): StatusStepDao
    abstract fun capturedMessageDao(): CapturedMessageDao
}
```

**Step 2: Hilt DatabaseModule 생성**

`di/DatabaseModule.kt`:
```kotlin
package com.nopti.mednotiv2.di

import android.content.Context
import androidx.room.Room
import com.nopti.mednotiv2.data.db.AppDatabase
import com.nopti.mednotiv2.data.db.dao.*
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): AppDatabase =
        Room.databaseBuilder(context, AppDatabase::class.java, "mednoti.db")
            .build()

    @Provides
    fun provideCategoryDao(db: AppDatabase): CategoryDao = db.categoryDao()

    @Provides
    fun provideFilterRuleDao(db: AppDatabase): FilterRuleDao = db.filterRuleDao()

    @Provides
    fun provideStatusStepDao(db: AppDatabase): StatusStepDao = db.statusStepDao()

    @Provides
    fun provideCapturedMessageDao(db: AppDatabase): CapturedMessageDao = db.capturedMessageDao()
}
```

**Step 3: 빌드 확인**

Run: `cd /mnt/c/AndroidStudio/MedNotiV2 && ./gradlew :app:compileDebugKotlin`
Expected: BUILD SUCCESSFUL

**Step 4: Commit**

```bash
git add app/src/main/java/com/nopti/mednotiv2/data/db/AppDatabase.kt \
  app/src/main/java/com/nopti/mednotiv2/di/DatabaseModule.kt
git commit -m "feat: add Room database and Hilt DI module"
```

---

### Task 6: Repository 레이어

**Files:**
- Create: `app/src/main/java/com/nopti/mednotiv2/data/repository/CategoryRepository.kt`
- Create: `app/src/main/java/com/nopti/mednotiv2/data/repository/FilterRuleRepository.kt`
- Create: `app/src/main/java/com/nopti/mednotiv2/data/repository/StatusStepRepository.kt`
- Create: `app/src/main/java/com/nopti/mednotiv2/data/repository/MessageRepository.kt`

**Step 1: CategoryRepository 생성**

`data/repository/CategoryRepository.kt`:
```kotlin
package com.nopti.mednotiv2.data.repository

import com.nopti.mednotiv2.data.db.dao.CategoryDao
import com.nopti.mednotiv2.data.db.entity.CategoryEntity
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CategoryRepository @Inject constructor(
    private val categoryDao: CategoryDao
) {
    fun getAll(): Flow<List<CategoryEntity>> = categoryDao.getAll()

    suspend fun getById(id: Long): CategoryEntity? = categoryDao.getById(id)

    suspend fun insert(category: CategoryEntity): Long = categoryDao.insert(category)

    suspend fun update(category: CategoryEntity) = categoryDao.update(category)

    suspend fun delete(category: CategoryEntity) = categoryDao.delete(category)
}
```

**Step 2: FilterRuleRepository 생성**

`data/repository/FilterRuleRepository.kt`:
```kotlin
package com.nopti.mednotiv2.data.repository

import com.nopti.mednotiv2.data.db.dao.FilterRuleDao
import com.nopti.mednotiv2.data.db.entity.FilterRuleEntity
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class FilterRuleRepository @Inject constructor(
    private val filterRuleDao: FilterRuleDao
) {
    fun getByCategoryId(categoryId: Long): Flow<List<FilterRuleEntity>> =
        filterRuleDao.getByCategoryId(categoryId)

    suspend fun getActiveRules(): List<FilterRuleEntity> = filterRuleDao.getActiveRules()

    suspend fun getById(id: Long): FilterRuleEntity? = filterRuleDao.getById(id)

    suspend fun insert(rule: FilterRuleEntity): Long = filterRuleDao.insert(rule)

    suspend fun update(rule: FilterRuleEntity) = filterRuleDao.update(rule)

    suspend fun delete(rule: FilterRuleEntity) = filterRuleDao.delete(rule)
}
```

**Step 3: StatusStepRepository 생성**

`data/repository/StatusStepRepository.kt`:
```kotlin
package com.nopti.mednotiv2.data.repository

import com.nopti.mednotiv2.data.db.dao.StatusStepDao
import com.nopti.mednotiv2.data.db.entity.StatusStepEntity
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class StatusStepRepository @Inject constructor(
    private val statusStepDao: StatusStepDao
) {
    fun getByCategoryId(categoryId: Long): Flow<List<StatusStepEntity>> =
        statusStepDao.getByCategoryId(categoryId)

    suspend fun getFirstStep(categoryId: Long): StatusStepEntity? =
        statusStepDao.getFirstStep(categoryId)

    suspend fun getById(id: Long): StatusStepEntity? = statusStepDao.getById(id)

    suspend fun insert(step: StatusStepEntity): Long = statusStepDao.insert(step)

    suspend fun update(step: StatusStepEntity) = statusStepDao.update(step)

    suspend fun updateAll(steps: List<StatusStepEntity>) = statusStepDao.updateAll(steps)

    suspend fun delete(step: StatusStepEntity) = statusStepDao.delete(step)
}
```

**Step 4: MessageRepository 생성**

`data/repository/MessageRepository.kt`:
```kotlin
package com.nopti.mednotiv2.data.repository

import com.nopti.mednotiv2.data.db.dao.CapturedMessageDao
import com.nopti.mednotiv2.data.db.dao.DayCategory
import com.nopti.mednotiv2.data.db.dao.StatusCount
import com.nopti.mednotiv2.data.db.entity.CapturedMessageEntity
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MessageRepository @Inject constructor(
    private val messageDao: CapturedMessageDao
) {
    fun getAll(): Flow<List<CapturedMessageEntity>> = messageDao.getAll()

    fun getByCategoryId(categoryId: Long): Flow<List<CapturedMessageEntity>> =
        messageDao.getByCategoryId(categoryId)

    fun getByDateRange(startOfDay: Long, endOfDay: Long): Flow<List<CapturedMessageEntity>> =
        messageDao.getByDateRange(startOfDay, endOfDay)

    fun getStatusCountsByDateRange(startOfDay: Long, endOfDay: Long): Flow<List<StatusCount>> =
        messageDao.getStatusCountsByDateRange(startOfDay, endOfDay)

    fun getMessageDaysInMonth(monthStart: Long, monthEnd: Long): Flow<List<DayCategory>> =
        messageDao.getMessageDaysInMonth(monthStart, monthEnd)

    suspend fun getById(id: Long): CapturedMessageEntity? = messageDao.getById(id)

    suspend fun insert(message: CapturedMessageEntity): Long = messageDao.insert(message)

    suspend fun update(message: CapturedMessageEntity) = messageDao.update(message)

    suspend fun delete(message: CapturedMessageEntity) = messageDao.delete(message)

    suspend fun updateStatus(messageId: Long, statusId: Long) =
        messageDao.updateStatus(messageId, statusId)
}
```

**Step 5: 빌드 확인**

Run: `cd /mnt/c/AndroidStudio/MedNotiV2 && ./gradlew :app:compileDebugKotlin`
Expected: BUILD SUCCESSFUL

**Step 6: Commit**

```bash
git add app/src/main/java/com/nopti/mednotiv2/data/repository/
git commit -m "feat: add repository layer for all entities"
```

---

### Task 7: 하단 네비게이션 + 기본 화면 골격

**Files:**
- Create: `app/src/main/java/com/nopti/mednotiv2/ui/navigation/Screen.kt`
- Create: `app/src/main/java/com/nopti/mednotiv2/ui/navigation/AppNavigation.kt`
- Create: `app/src/main/java/com/nopti/mednotiv2/ui/message/MessageListScreen.kt`
- Create: `app/src/main/java/com/nopti/mednotiv2/ui/calendar/CalendarScreen.kt`
- Create: `app/src/main/java/com/nopti/mednotiv2/ui/filter/FilterScreen.kt`
- Create: `app/src/main/java/com/nopti/mednotiv2/ui/status/StatusScreen.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/MainActivity.kt`

**Step 1: Screen sealed class 생성**

`ui/navigation/Screen.kt`:
```kotlin
package com.nopti.mednotiv2.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.FilterAlt
import androidx.compose.material.icons.filled.Message
import androidx.compose.material.icons.filled.Tune
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(val route: String, val label: String, val icon: ImageVector) {
    data object Messages : Screen("messages", "메시지", Icons.Default.Message)
    data object Calendar : Screen("calendar", "캘린더", Icons.Default.CalendarMonth)
    data object Filter : Screen("filter", "필터", Icons.Default.FilterAlt)
    data object Status : Screen("status", "상태", Icons.Default.Tune)
}
```

**Step 2: 각 화면의 placeholder Composable 생성**

`ui/message/MessageListScreen.kt`:
```kotlin
package com.nopti.mednotiv2.ui.message

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier

@Composable
fun MessageListScreen() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text("메시지 목록")
    }
}
```

`ui/calendar/CalendarScreen.kt`:
```kotlin
package com.nopti.mednotiv2.ui.calendar

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier

@Composable
fun CalendarScreen() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text("캘린더")
    }
}
```

`ui/filter/FilterScreen.kt`:
```kotlin
package com.nopti.mednotiv2.ui.filter

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier

@Composable
fun FilterScreen() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text("필터 설정")
    }
}
```

`ui/status/StatusScreen.kt`:
```kotlin
package com.nopti.mednotiv2.ui.status

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier

@Composable
fun StatusScreen() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text("상태 관리")
    }
}
```

**Step 3: AppNavigation Composable 생성**

`ui/navigation/AppNavigation.kt`:
```kotlin
package com.nopti.mednotiv2.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.nopti.mednotiv2.ui.calendar.CalendarScreen
import com.nopti.mednotiv2.ui.filter.FilterScreen
import com.nopti.mednotiv2.ui.message.MessageListScreen
import com.nopti.mednotiv2.ui.status.StatusScreen

@Composable
fun AppNavigation() {
    val navController = rememberNavController()
    val tabs = listOf(Screen.Messages, Screen.Calendar, Screen.Filter, Screen.Status)

    Scaffold(
        bottomBar = {
            NavigationBar {
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentDestination = navBackStackEntry?.destination
                tabs.forEach { screen ->
                    NavigationBarItem(
                        icon = { Icon(screen.icon, contentDescription = screen.label) },
                        label = { Text(screen.label) },
                        selected = currentDestination?.hierarchy?.any { it.route == screen.route } == true,
                        onClick = {
                            navController.navigate(screen.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        }
                    )
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Messages.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(Screen.Messages.route) { MessageListScreen() }
            composable(Screen.Calendar.route) { CalendarScreen() }
            composable(Screen.Filter.route) { FilterScreen() }
            composable(Screen.Status.route) { StatusScreen() }
        }
    }
}
```

**Step 4: MainActivity에서 AppNavigation 사용**

```kotlin
package com.nopti.mednotiv2

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.nopti.mednotiv2.ui.navigation.AppNavigation
import com.nopti.mednotiv2.ui.theme.MedNotiV2Theme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MedNotiV2Theme {
                AppNavigation()
            }
        }
    }
}
```

**Step 5: 빌드 확인**

Run: `cd /mnt/c/AndroidStudio/MedNotiV2 && ./gradlew :app:compileDebugKotlin`
Expected: BUILD SUCCESSFUL

**Step 6: Commit**

```bash
git add app/src/main/java/com/nopti/mednotiv2/ui/ \
  app/src/main/java/com/nopti/mednotiv2/MainActivity.kt
git commit -m "feat: add bottom navigation with 4 tab screens"
```

---

### Task 8: NotificationListenerService + 필터 엔진

**Files:**
- Create: `app/src/main/java/com/nopti/mednotiv2/service/notification/MessageFilterEngine.kt`
- Create: `app/src/main/java/com/nopti/mednotiv2/service/notification/MedNotiListenerService.kt`
- Create: `app/src/main/java/com/nopti/mednotiv2/service/notification/SmsReceiver.kt`
- Modify: `app/src/main/AndroidManifest.xml`

**Step 1: MessageFilterEngine 생성**

`service/notification/MessageFilterEngine.kt`:
```kotlin
package com.nopti.mednotiv2.service.notification

import com.nopti.mednotiv2.data.db.entity.FilterRuleEntity
import com.nopti.mednotiv2.data.model.MessageSource

class MessageFilterEngine {

    fun findMatchingRule(
        rules: List<FilterRuleEntity>,
        source: MessageSource,
        sender: String,
        content: String
    ): FilterRuleEntity? {
        return rules.firstOrNull { rule ->
            matchesSource(rule, source) &&
                matchesSender(rule, sender) &&
                matchesIncludeWords(rule, content) &&
                !matchesExcludeWords(rule, content)
        }
    }

    private fun matchesSource(rule: FilterRuleEntity, source: MessageSource): Boolean =
        rule.source == MessageSource.ALL || rule.source == source

    private fun matchesSender(rule: FilterRuleEntity, sender: String): Boolean =
        rule.senderKeyword.isNullOrBlank() || sender.contains(rule.senderKeyword, ignoreCase = true)

    private fun matchesIncludeWords(rule: FilterRuleEntity, content: String): Boolean =
        rule.includeWords.isEmpty() || rule.includeWords.any { content.contains(it, ignoreCase = true) }

    private fun matchesExcludeWords(rule: FilterRuleEntity, content: String): Boolean =
        rule.excludeWords.isNotEmpty() && rule.excludeWords.any { content.contains(it, ignoreCase = true) }
}
```

**Step 2: MedNotiListenerService 생성**

`service/notification/MedNotiListenerService.kt`:
```kotlin
package com.nopti.mednotiv2.service.notification

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.nopti.mednotiv2.data.db.entity.CapturedMessageEntity
import com.nopti.mednotiv2.data.model.MessageSource
import com.nopti.mednotiv2.data.repository.FilterRuleRepository
import com.nopti.mednotiv2.data.repository.MessageRepository
import com.nopti.mednotiv2.data.repository.StatusStepRepository
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class MedNotiListenerService : NotificationListenerService() {

    @Inject lateinit var filterRuleRepository: FilterRuleRepository
    @Inject lateinit var messageRepository: MessageRepository
    @Inject lateinit var statusStepRepository: StatusStepRepository

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val filterEngine = MessageFilterEngine()

    companion object {
        private const val KAKAO_PACKAGE = "com.kakao.talk"
        private val SMS_PACKAGES = setOf(
            "com.samsung.android.messaging",
            "com.google.android.apps.messaging",
            "com.android.mms"
        )
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        sbn ?: return
        val packageName = sbn.packageName

        val source = when {
            packageName == KAKAO_PACKAGE -> MessageSource.KAKAO
            packageName in SMS_PACKAGES -> MessageSource.SMS
            else -> return
        }

        val extras = sbn.notification.extras
        val sender = extras.getCharSequence("android.title")?.toString() ?: return
        val content = extras.getCharSequence("android.text")?.toString() ?: return

        scope.launch {
            processMessage(source, sender, content)
        }
    }

    private suspend fun processMessage(source: MessageSource, sender: String, content: String) {
        val activeRules = filterRuleRepository.getActiveRules()
        val matchedRule = filterEngine.findMatchingRule(activeRules, source, sender, content) ?: return

        val firstStatus = statusStepRepository.getFirstStep(matchedRule.categoryId)

        val message = CapturedMessageEntity(
            categoryId = matchedRule.categoryId,
            matchedRuleId = matchedRule.id,
            source = source,
            sender = sender,
            content = content,
            statusId = firstStatus?.id
        )
        messageRepository.insert(message)
    }
}
```

**Step 3: SmsReceiver 생성**

`service/notification/SmsReceiver.kt`:
```kotlin
package com.nopti.mednotiv2.service.notification

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import com.nopti.mednotiv2.data.db.entity.CapturedMessageEntity
import com.nopti.mednotiv2.data.model.MessageSource
import com.nopti.mednotiv2.data.repository.FilterRuleRepository
import com.nopti.mednotiv2.data.repository.MessageRepository
import com.nopti.mednotiv2.data.repository.StatusStepRepository
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class SmsReceiver : BroadcastReceiver() {

    @Inject lateinit var filterRuleRepository: FilterRuleRepository
    @Inject lateinit var messageRepository: MessageRepository
    @Inject lateinit var statusStepRepository: StatusStepRepository

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val filterEngine = MessageFilterEngine()

    override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        messages.forEach { smsMessage ->
            val sender = smsMessage.displayOriginatingAddress ?: return@forEach
            val content = smsMessage.displayMessageBody ?: return@forEach

            scope.launch {
                val activeRules = filterRuleRepository.getActiveRules()
                val matchedRule = filterEngine.findMatchingRule(activeRules, MessageSource.SMS, sender, content) ?: return@launch
                val firstStatus = statusStepRepository.getFirstStep(matchedRule.categoryId)

                messageRepository.insert(
                    CapturedMessageEntity(
                        categoryId = matchedRule.categoryId,
                        matchedRuleId = matchedRule.id,
                        source = MessageSource.SMS,
                        sender = sender,
                        content = content,
                        statusId = firstStatus?.id
                    )
                )
            }
        }
    }
}
```

**Step 4: AndroidManifest.xml에 서비스/리시버/권한 등록**

`<manifest>` 태그 안, `<application>` 태그 위에 권한 추가:
```xml
<uses-permission android:name="android.permission.RECEIVE_SMS" />
<uses-permission android:name="android.permission.READ_SMS" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

`<application>` 태그 안에 서비스/리시버 추가:
```xml
<service
    android:name=".service.notification.MedNotiListenerService"
    android:exported="true"
    android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE">
    <intent-filter>
        <action android:name="android.service.notification.NotificationListenerService" />
    </intent-filter>
</service>

<receiver
    android:name=".service.notification.SmsReceiver"
    android:exported="true"
    android:permission="android.permission.BROADCAST_SMS">
    <intent-filter>
        <action android:name="android.provider.Telephony.SMS_RECEIVED" />
    </intent-filter>
</receiver>
```

**Step 5: 빌드 확인**

Run: `cd /mnt/c/AndroidStudio/MedNotiV2 && ./gradlew :app:compileDebugKotlin`
Expected: BUILD SUCCESSFUL

**Step 6: Commit**

```bash
git add app/src/main/java/com/nopti/mednotiv2/service/ \
  app/src/main/AndroidManifest.xml
git commit -m "feat: add NotificationListenerService, SMS receiver, and filter engine"
```

---

### Task 9: 필터/카테고리 설정 화면 (ViewModel + UI)

**Files:**
- Create: `app/src/main/java/com/nopti/mednotiv2/viewmodel/FilterViewModel.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/filter/FilterScreen.kt`
- Create: `app/src/main/java/com/nopti/mednotiv2/ui/filter/CategoryEditDialog.kt`
- Create: `app/src/main/java/com/nopti/mednotiv2/ui/filter/FilterRuleEditDialog.kt`
- Create: `app/src/main/java/com/nopti/mednotiv2/ui/components/ColorPicker.kt`

**Step 1: FilterViewModel 생성**

`viewmodel/FilterViewModel.kt`:
```kotlin
package com.nopti.mednotiv2.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nopti.mednotiv2.data.db.entity.CategoryEntity
import com.nopti.mednotiv2.data.db.entity.FilterRuleEntity
import com.nopti.mednotiv2.data.model.MessageSource
import com.nopti.mednotiv2.data.repository.CategoryRepository
import com.nopti.mednotiv2.data.repository.FilterRuleRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class FilterViewModel @Inject constructor(
    private val categoryRepository: CategoryRepository,
    private val filterRuleRepository: FilterRuleRepository
) : ViewModel() {

    val categories: StateFlow<List<CategoryEntity>> = categoryRepository.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _selectedCategoryId = MutableStateFlow<Long?>(null)
    val selectedCategoryId: StateFlow<Long?> = _selectedCategoryId

    val rulesForCategory: StateFlow<List<FilterRuleEntity>> = _selectedCategoryId
        .flatMapLatest { id ->
            if (id != null) filterRuleRepository.getByCategoryId(id) else flowOf(emptyList())
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun selectCategory(id: Long?) { _selectedCategoryId.value = id }

    fun addCategory(name: String, color: Int) {
        viewModelScope.launch {
            categoryRepository.insert(CategoryEntity(name = name, color = color))
        }
    }

    fun updateCategory(category: CategoryEntity) {
        viewModelScope.launch { categoryRepository.update(category) }
    }

    fun deleteCategory(category: CategoryEntity) {
        viewModelScope.launch { categoryRepository.delete(category) }
    }

    fun addRule(categoryId: Long, source: MessageSource, senderKeyword: String?, includeWords: List<String>, excludeWords: List<String>) {
        viewModelScope.launch {
            filterRuleRepository.insert(
                FilterRuleEntity(
                    categoryId = categoryId,
                    source = source,
                    senderKeyword = senderKeyword?.ifBlank { null },
                    includeWords = includeWords,
                    excludeWords = excludeWords
                )
            )
        }
    }

    fun updateRule(rule: FilterRuleEntity) {
        viewModelScope.launch { filterRuleRepository.update(rule) }
    }

    fun deleteRule(rule: FilterRuleEntity) {
        viewModelScope.launch { filterRuleRepository.delete(rule) }
    }
}
```

**Step 2~5: UI Composable 파일들** — FilterScreen, CategoryEditDialog, FilterRuleEditDialog, ColorPicker를 구현합니다. 각 파일의 상세 코드는 구현 시 Task 9 서브에이전트가 위 ViewModel과 설계 문서의 화면 명세를 참고하여 작성합니다. 주요 UI 요소:

- **FilterScreen**: 카테고리 목록 + 탭 시 해당 규칙 목록 표시, FAB으로 추가
- **CategoryEditDialog**: 이름 입력 + 색상 선택 다이얼로그
- **FilterRuleEditDialog**: 소스 선택(드롭다운), 발신자 키워드, 포함/제외 키워드(칩 입력), 활성 토글
- **ColorPicker**: 미리 정의된 색상 중 선택하는 간단한 그리드

**Step 6: 빌드 확인 및 Commit**

```bash
git add app/src/main/java/com/nopti/mednotiv2/viewmodel/FilterViewModel.kt \
  app/src/main/java/com/nopti/mednotiv2/ui/filter/ \
  app/src/main/java/com/nopti/mednotiv2/ui/components/
git commit -m "feat: add filter/category settings screen with ViewModel"
```

---

### Task 10: 상태 관리 화면 (ViewModel + UI)

**Files:**
- Create: `app/src/main/java/com/nopti/mednotiv2/viewmodel/StatusViewModel.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/status/StatusScreen.kt`
- Create: `app/src/main/java/com/nopti/mednotiv2/ui/status/StatusStepEditDialog.kt`

**Step 1: StatusViewModel 생성**

`viewmodel/StatusViewModel.kt`:
```kotlin
package com.nopti.mednotiv2.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nopti.mednotiv2.data.db.entity.StatusStepEntity
import com.nopti.mednotiv2.data.repository.CategoryRepository
import com.nopti.mednotiv2.data.repository.StatusStepRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class StatusViewModel @Inject constructor(
    private val categoryRepository: CategoryRepository,
    private val statusStepRepository: StatusStepRepository
) : ViewModel() {

    val categories = categoryRepository.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _selectedCategoryId = MutableStateFlow<Long?>(null)
    val selectedCategoryId: StateFlow<Long?> = _selectedCategoryId

    val stepsForCategory: StateFlow<List<StatusStepEntity>> = _selectedCategoryId
        .flatMapLatest { id ->
            if (id != null) statusStepRepository.getByCategoryId(id) else flowOf(emptyList())
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun selectCategory(id: Long) { _selectedCategoryId.value = id }

    fun addStep(categoryId: Long, name: String, color: Int) {
        viewModelScope.launch {
            val currentSteps = stepsForCategory.value
            val nextOrder = (currentSteps.maxOfOrNull { it.orderIndex } ?: -1) + 1
            statusStepRepository.insert(
                StatusStepEntity(categoryId = categoryId, name = name, orderIndex = nextOrder, color = color)
            )
        }
    }

    fun updateStep(step: StatusStepEntity) {
        viewModelScope.launch { statusStepRepository.update(step) }
    }

    fun deleteStep(step: StatusStepEntity) {
        viewModelScope.launch { statusStepRepository.delete(step) }
    }

    fun reorderSteps(reordered: List<StatusStepEntity>) {
        viewModelScope.launch {
            val updated = reordered.mapIndexed { index, step -> step.copy(orderIndex = index) }
            statusStepRepository.updateAll(updated)
        }
    }
}
```

**Step 2~3: UI Composable 파일들** — StatusScreen, StatusStepEditDialog 구현. 주요 UI 요소:

- **StatusScreen**: 카테고리 드롭다운 + 상태 단계 리스트(드래그 순서 변경) + FAB 추가
- **StatusStepEditDialog**: 이름 입력 + 색상 선택

**Step 4: 빌드 확인 및 Commit**

```bash
git add app/src/main/java/com/nopti/mednotiv2/viewmodel/StatusViewModel.kt \
  app/src/main/java/com/nopti/mednotiv2/ui/status/
git commit -m "feat: add status step management screen with ViewModel"
```

---

### Task 11: 메시지 목록 화면 (ViewModel + UI)

**Files:**
- Create: `app/src/main/java/com/nopti/mednotiv2/viewmodel/MessageViewModel.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/message/MessageListScreen.kt`
- Create: `app/src/main/java/com/nopti/mednotiv2/ui/message/MessageDetailScreen.kt`
- Create: `app/src/main/java/com/nopti/mednotiv2/ui/message/MessageCard.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/navigation/AppNavigation.kt`

**Step 1: MessageViewModel 생성**

`viewmodel/MessageViewModel.kt`:
```kotlin
package com.nopti.mednotiv2.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nopti.mednotiv2.data.db.entity.CategoryEntity
import com.nopti.mednotiv2.data.db.entity.CapturedMessageEntity
import com.nopti.mednotiv2.data.db.entity.StatusStepEntity
import com.nopti.mednotiv2.data.repository.CategoryRepository
import com.nopti.mednotiv2.data.repository.MessageRepository
import com.nopti.mednotiv2.data.repository.StatusStepRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class MessageViewModel @Inject constructor(
    private val messageRepository: MessageRepository,
    private val categoryRepository: CategoryRepository,
    private val statusStepRepository: StatusStepRepository
) : ViewModel() {

    val categories = categoryRepository.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _filterCategoryId = MutableStateFlow<Long?>(null)
    val filterCategoryId: StateFlow<Long?> = _filterCategoryId

    private val _filterStatusId = MutableStateFlow<Long?>(null)

    val messages: StateFlow<List<CapturedMessageEntity>> = combine(
        _filterCategoryId, _filterStatusId
    ) { catId, statusId -> Pair(catId, statusId) }
        .flatMapLatest { (catId, _) ->
            if (catId != null) messageRepository.getByCategoryId(catId) else messageRepository.getAll()
        }
        .combine(_filterStatusId) { msgs, statusId ->
            if (statusId != null) msgs.filter { it.statusId == statusId } else msgs
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Cache of all status steps by category for display
    private val _allStatusSteps = MutableStateFlow<Map<Long, List<StatusStepEntity>>>(emptyMap())
    val allStatusSteps: StateFlow<Map<Long, List<StatusStepEntity>>> = _allStatusSteps

    init {
        viewModelScope.launch {
            categoryRepository.getAll().collect { cats ->
                val map = mutableMapOf<Long, List<StatusStepEntity>>()
                cats.forEach { cat ->
                    statusStepRepository.getByCategoryId(cat.id).first().let { steps ->
                        map[cat.id] = steps
                    }
                }
                _allStatusSteps.value = map
            }
        }
    }

    fun setFilterCategory(id: Long?) { _filterCategoryId.value = id }
    fun setFilterStatus(id: Long?) { _filterStatusId.value = id }

    fun updateMessageStatus(messageId: Long, statusId: Long) {
        viewModelScope.launch { messageRepository.updateStatus(messageId, statusId) }
    }

    fun deleteMessage(message: CapturedMessageEntity) {
        viewModelScope.launch { messageRepository.delete(message) }
    }
}
```

**Step 2~4: UI Composable 파일들** — MessageListScreen(필터칩 + 카드리스트), MessageCard(개별 메시지 카드), MessageDetailScreen(상세 + 상태 변경) 구현. AppNavigation에 상세 화면 route 추가.

**Step 5: 빌드 확인 및 Commit**

```bash
git add app/src/main/java/com/nopti/mednotiv2/viewmodel/MessageViewModel.kt \
  app/src/main/java/com/nopti/mednotiv2/ui/message/ \
  app/src/main/java/com/nopti/mednotiv2/ui/navigation/AppNavigation.kt
git commit -m "feat: add message list screen with filtering and status update"
```

---

### Task 12: 캘린더 화면 (ViewModel + UI)

**Files:**
- Create: `app/src/main/java/com/nopti/mednotiv2/viewmodel/CalendarViewModel.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/ui/calendar/CalendarScreen.kt`
- Create: `app/src/main/java/com/nopti/mednotiv2/ui/calendar/CalendarGrid.kt`
- Create: `app/src/main/java/com/nopti/mednotiv2/ui/calendar/StatusStatsBar.kt`

**Step 1: CalendarViewModel 생성**

`viewmodel/CalendarViewModel.kt`:
```kotlin
package com.nopti.mednotiv2.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nopti.mednotiv2.data.db.dao.DayCategory
import com.nopti.mednotiv2.data.db.dao.StatusCount
import com.nopti.mednotiv2.data.db.entity.CapturedMessageEntity
import com.nopti.mednotiv2.data.repository.CategoryRepository
import com.nopti.mednotiv2.data.repository.MessageRepository
import com.nopti.mednotiv2.data.repository.StatusStepRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId
import javax.inject.Inject

@HiltViewModel
class CalendarViewModel @Inject constructor(
    private val messageRepository: MessageRepository,
    private val categoryRepository: CategoryRepository,
    private val statusStepRepository: StatusStepRepository
) : ViewModel() {

    val categories = categoryRepository.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _currentMonth = MutableStateFlow(YearMonth.now())
    val currentMonth: StateFlow<YearMonth> = _currentMonth

    private val _selectedDate = MutableStateFlow<LocalDate?>(null)
    val selectedDate: StateFlow<LocalDate?> = _selectedDate

    val messageDaysInMonth: StateFlow<List<DayCategory>> = _currentMonth
        .flatMapLatest { month ->
            val start = month.atDay(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
            val end = month.atEndOfMonth().plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
            messageRepository.getMessageDaysInMonth(start, end)
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val messagesForSelectedDate: StateFlow<List<CapturedMessageEntity>> = _selectedDate
        .flatMapLatest { date ->
            if (date != null) {
                val start = date.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
                val end = date.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
                messageRepository.getByDateRange(start, end)
            } else flowOf(emptyList())
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val statusCountsForSelectedDate: StateFlow<List<StatusCount>> = _selectedDate
        .flatMapLatest { date ->
            if (date != null) {
                val start = date.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
                val end = date.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
                messageRepository.getStatusCountsByDateRange(start, end)
            } else flowOf(emptyList())
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun previousMonth() { _currentMonth.value = _currentMonth.value.minusMonths(1) }
    fun nextMonth() { _currentMonth.value = _currentMonth.value.plusMonths(1) }
    fun selectDate(date: LocalDate) { _selectedDate.value = date }
}
```

**Step 2~3: UI Composable 파일들** — CalendarScreen(전체 레이아웃), CalendarGrid(월별 그리드 + 색상 점), StatusStatsBar(상태별 통계 바) 구현.

**Step 4: 빌드 확인 및 Commit**

```bash
git add app/src/main/java/com/nopti/mednotiv2/viewmodel/CalendarViewModel.kt \
  app/src/main/java/com/nopti/mednotiv2/ui/calendar/
git commit -m "feat: add calendar view with monthly grid and status statistics"
```

---

### Task 13: 권한 요청 + 알림 리스너 설정 안내 화면

**Files:**
- Create: `app/src/main/java/com/nopti/mednotiv2/ui/components/PermissionHandler.kt`
- Modify: `app/src/main/java/com/nopti/mednotiv2/MainActivity.kt`

**Step 1: PermissionHandler 생성**

Runtime 권한(SMS, Notification) 요청 및 NotificationListenerService 활성화 안내 다이얼로그를 포함하는 Composable. 앱 처음 실행 시 필요한 권한이 없으면 안내 화면 표시.

주요 로직:
- `Settings.Secure.getString(contentResolver, "enabled_notification_listeners")`로 알림 리스너 활성 여부 확인
- 비활성이면 시스템 설정(`Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS`)으로 이동하는 버튼 표시
- SMS 권한은 `rememberLauncherForActivityResult`로 요청

**Step 2: MainActivity에 PermissionHandler 통합**

AppNavigation 호출 전에 권한 확인 로직 추가.

**Step 3: 빌드 확인 및 Commit**

```bash
git add app/src/main/java/com/nopti/mednotiv2/ui/components/PermissionHandler.kt \
  app/src/main/java/com/nopti/mednotiv2/MainActivity.kt
git commit -m "feat: add permission request and notification listener setup guide"
```

---

## 구현 순서 요약

| Task | 내용 | 의존성 |
|------|------|--------|
| 1 | Gradle 의존성 설정 | 없음 |
| 2 | Hilt Application + 기본 구조 | Task 1 |
| 3 | Room Entity + Enum + Converter | Task 1 |
| 4 | Room DAO | Task 3 |
| 5 | Room Database + Hilt DI 모듈 | Task 2, 4 |
| 6 | Repository 레이어 | Task 5 |
| 7 | 하단 네비게이션 + 화면 골격 | Task 2 |
| 8 | NotificationListener + 필터 엔진 | Task 6 |
| 9 | 필터/카테고리 설정 화면 | Task 6, 7 |
| 10 | 상태 관리 화면 | Task 6, 7 |
| 11 | 메시지 목록 화면 | Task 6, 7 |
| 12 | 캘린더 화면 | Task 6, 7 |
| 13 | 권한 요청 + 설정 안내 | Task 8 |
