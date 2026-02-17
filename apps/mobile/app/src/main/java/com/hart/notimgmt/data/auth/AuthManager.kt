package com.hart.notimgmt.data.auth

import android.util.Log
import com.hart.notimgmt.data.sync.SyncManager
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.status.SessionStatus
import io.github.jan.supabase.auth.user.UserInfo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthManager @Inject constructor(
    private val auth: Auth,
    private val syncManager: SyncManager
) {
    companion object {
        private const val TAG = "AuthManager"
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var syncStarted = false

    val currentUser: UserInfo?
        get() = auth.currentUserOrNull()

    val isLoggedIn: Boolean
        get() = currentUser != null

    val userId: String?
        get() = currentUser?.id

    init {
        // 세션 상태를 비동기로 관찰하여 복원 완료 시 동기화 시작.
        // Supabase Auth는 세션을 디스크에서 비동기로 복원하므로,
        // init{} 시점에서 currentUserOrNull()은 항상 null을 반환한다.
        scope.launch {
            auth.sessionStatus.collect { status ->
                when (status) {
                    is SessionStatus.Authenticated -> {
                        if (!syncStarted) {
                            Log.d(TAG, "Session restored — starting sync")
                            syncStarted = true
                            syncManager.startListening()
                            syncManager.schedulePeriodicSync()
                        }
                    }
                    is SessionStatus.NotAuthenticated -> {
                        if (syncStarted) {
                            Log.d(TAG, "Session lost — stopping sync")
                            syncStarted = false
                            syncManager.stopListening()
                        }
                    }
                    else -> {} // Initializing, RefreshFailure — 대기
                }
            }
        }
    }

    fun observeAuthState(): Flow<UserInfo?> = auth.sessionStatus.map { status ->
        when (status) {
            is SessionStatus.Authenticated -> status.session.user
            else -> null
        }
    }

    /**
     * 이메일/비밀번호로 로그인
     */
    suspend fun signInWithEmail(email: String, password: String): Result<UserInfo> {
        return try {
            Log.d(TAG, "Signing in with email: $email")
            auth.signInWith(Email) {
                this.email = email
                this.password = password
            }

            val user = auth.currentUserOrNull()
            if (user != null) {
                Log.d(TAG, "Sign-in success: ${user.email}")
                // 로그인 성공 시 동기화 시작
                syncManager.startListening()
                syncManager.schedulePeriodicSync()
                Result.success(user)
            } else {
                Result.failure(Exception("로그인 결과에서 사용자 정보를 찾을 수 없습니다"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "Sign-in failed", e)
            val message = when {
                e.message?.contains("Invalid login credentials") == true -> "이메일 또는 비밀번호가 올바르지 않습니다"
                e.message?.contains("Email not confirmed") == true -> "이메일 인증이 필요합니다"
                else -> e.message ?: "로그인에 실패했습니다"
            }
            Result.failure(Exception(message))
        }
    }

    /**
     * 이메일/비밀번호로 회원가입
     */
    suspend fun signUpWithEmail(email: String, password: String): Result<UserInfo> {
        return try {
            Log.d(TAG, "Signing up with email: $email")
            auth.signUpWith(Email) {
                this.email = email
                this.password = password
            }

            val user = auth.currentUserOrNull()
            if (user != null) {
                Log.d(TAG, "Sign-up success: ${user.email}")
                // 회원가입 성공 시 동기화 시작
                syncManager.startListening()
                syncManager.schedulePeriodicSync()
                Result.success(user)
            } else {
                Result.failure(Exception("회원가입 결과에서 사용자 정보를 찾을 수 없습니다"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "Sign-up failed", e)
            val message = when {
                e.message?.contains("Password should be at least") == true -> "비밀번호는 6자 이상이어야 합니다"
                e.message?.contains("Unable to validate email") == true -> "유효하지 않은 이메일 형식입니다"
                e.message?.contains("User already registered") == true -> "이미 등록된 이메일입니다"
                else -> e.message ?: "회원가입에 실패했습니다"
            }
            Result.failure(Exception(message))
        }
    }

    /**
     * 비밀번호 재설정 이메일 전송
     */
    suspend fun sendPasswordResetEmail(email: String): Result<Unit> {
        return try {
            Log.d(TAG, "Sending password reset email to: $email")
            auth.resetPasswordForEmail(email)
            Log.d(TAG, "Password reset email sent")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send password reset email", e)
            Result.failure(Exception(e.message ?: "이메일 전송에 실패했습니다"))
        }
    }

    suspend fun signOut() {
        // 로그아웃 시 동기화 중지
        syncManager.stopListening()
        auth.signOut()
    }

    fun getUserDisplayName(): String? = currentUser?.userMetadata?.get("display_name")?.toString()
    fun getUserEmail(): String? = currentUser?.email
    fun getUserPhotoUrl(): String? = currentUser?.userMetadata?.get("avatar_url")?.toString()
}
