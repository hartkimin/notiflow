package com.hart.notimgmt.ui.login

import android.app.Activity
import android.content.Intent
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.hart.notimgmt.BuildConfig
import com.hart.notimgmt.data.auth.AuthManager
import com.hart.notimgmt.data.model.AppMode
import com.hart.notimgmt.data.preferences.AppPreferences
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.serializer.KotlinXSerializer
import kotlinx.serialization.json.Json
import kotlinx.coroutines.launch
import kotlin.system.exitProcess

private enum class LoginMode {
    SIGN_IN,        // 로그인
    SIGN_UP,        // 회원가입
    RESET_PASSWORD  // 비밀번호 재설정
}

@Composable
fun LoginScreen(
    authManager: AuthManager,
    appPreferences: AppPreferences,
    onLoginSuccess: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val focusManager = LocalFocusManager.current

    var isLoading by remember { mutableStateOf(false) }
    var loginMode by remember { mutableStateOf(LoginMode.SIGN_IN) }
    var rememberLogin by remember { mutableStateOf(appPreferences.saveCredentials) }
    var serverUrl by remember { mutableStateOf(appPreferences.supabaseUrl) }
    var email by remember { mutableStateOf(appPreferences.savedEmail ?: "") }
    var password by remember { mutableStateOf(appPreferences.savedPassword ?: "") }
    var confirmPassword by remember { mutableStateOf("") }
    var emailError by remember { mutableStateOf<String?>(null) }
    var passwordError by remember { mutableStateOf<String?>(null) }
    var passwordVisible by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Spacer(modifier = Modifier.weight(1f))

        // 앱 아이콘
        Box(
            modifier = Modifier
                .size(100.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.1f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.NotificationsActive,
                contentDescription = null,
                modifier = Modifier.size(50.dp),
                tint = MaterialTheme.colorScheme.primary
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        // 앱 이름
        Text(
            text = "NotiRoute",
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onBackground
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = when (loginMode) {
                LoginMode.SIGN_IN -> "알림의 흐름을 관리하세요"
                LoginMode.SIGN_UP -> "새 계정 만들기"
                LoginMode.RESET_PASSWORD -> "비밀번호 재설정"
            },
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.weight(1f))

        // 서버 주소 입력
        OutlinedTextField(
            value = serverUrl,
            onValueChange = { serverUrl = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("서버 주소") },
            placeholder = { Text("https://www.notiflow.life") },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Default.Language,
                    contentDescription = null
                )
            },
            singleLine = true,
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Uri,
                imeAction = ImeAction.Next
            ),
            keyboardActions = KeyboardActions(
                onNext = { focusManager.moveFocus(FocusDirection.Down) }
            )
        )

        Spacer(modifier = Modifier.height(12.dp))

        // 이메일 입력
        OutlinedTextField(
            value = email,
            onValueChange = {
                email = it
                emailError = null
            },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("이메일") },
            placeholder = { Text("example@email.com") },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Default.Email,
                    contentDescription = null
                )
            },
            isError = emailError != null,
            supportingText = emailError?.let { { Text(it) } },
            singleLine = true,
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Email,
                imeAction = if (loginMode == LoginMode.RESET_PASSWORD) ImeAction.Done else ImeAction.Next
            ),
            keyboardActions = KeyboardActions(
                onNext = { focusManager.moveFocus(FocusDirection.Down) },
                onDone = {
                    if (loginMode == LoginMode.RESET_PASSWORD && isValidEmail(email)) {
                        // 비밀번호 재설정 실행
                        isLoading = true
                        coroutineScope.launch {
                            val result = authManager.sendPasswordResetEmail(email)
                            isLoading = false
                            result.fold(
                                onSuccess = {
                                    Toast.makeText(context, "비밀번호 재설정 이메일을 전송했습니다", Toast.LENGTH_SHORT).show()
                                    loginMode = LoginMode.SIGN_IN
                                },
                                onFailure = { e ->
                                    emailError = e.message
                                }
                            )
                        }
                    }
                }
            )
        )

        // 비밀번호 입력 (비밀번호 재설정 모드가 아닐 때만)
        if (loginMode != LoginMode.RESET_PASSWORD) {
            Spacer(modifier = Modifier.height(12.dp))

            OutlinedTextField(
                value = password,
                onValueChange = {
                    password = it
                    passwordError = null
                },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("비밀번호") },
                placeholder = { Text("6자 이상") },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = null
                    )
                },
                trailingIcon = {
                    IconButton(onClick = { passwordVisible = !passwordVisible }) {
                        Icon(
                            imageVector = if (passwordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                            contentDescription = if (passwordVisible) "비밀번호 숨기기" else "비밀번호 보기"
                        )
                    }
                },
                isError = passwordError != null,
                supportingText = passwordError?.let { { Text(it) } },
                singleLine = true,
                visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Password,
                    imeAction = if (loginMode == LoginMode.SIGN_UP) ImeAction.Next else ImeAction.Done
                ),
                keyboardActions = KeyboardActions(
                    onNext = { focusManager.moveFocus(FocusDirection.Down) },
                    onDone = {
                        if (loginMode == LoginMode.SIGN_IN) {
                            focusManager.clearFocus()
                        }
                    }
                )
            )

            // 비밀번호 확인 (회원가입 모드일 때만)
            if (loginMode == LoginMode.SIGN_UP) {
                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = confirmPassword,
                    onValueChange = {
                        confirmPassword = it
                        passwordError = null
                    },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("비밀번호 확인") },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Default.Lock,
                            contentDescription = null
                        )
                    },
                    isError = passwordError != null,
                    singleLine = true,
                    visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        imeAction = ImeAction.Done
                    ),
                    keyboardActions = KeyboardActions(
                        onDone = { focusManager.clearFocus() }
                    )
                )
            }

            // 로그인 정보 저장 체크박스
            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Checkbox(
                    checked = rememberLogin,
                    onCheckedChange = { rememberLogin = it }
                )
                Text(
                    text = "로그인 정보 저장",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // 메인 버튼
        ActionButton(
            text = when (loginMode) {
                LoginMode.SIGN_IN -> "로그인"
                LoginMode.SIGN_UP -> "회원가입"
                LoginMode.RESET_PASSWORD -> "재설정 이메일 보내기"
            },
            isLoading = isLoading,
            onClick = {
                // 유효성 검사
                if (!isValidEmail(email)) {
                    emailError = "올바른 이메일 주소를 입력하세요"
                    return@ActionButton
                }

                when (loginMode) {
                    LoginMode.SIGN_IN -> {
                        if (password.isEmpty()) {
                            passwordError = "비밀번호를 입력하세요"
                            return@ActionButton
                        }

                        isLoading = true
                        val urlToUse = serverUrl.ifBlank { BuildConfig.SUPABASE_URL }
                        val urlChanged = urlToUse != appPreferences.supabaseUrl
                        val enteredEmail = email
                        val enteredPassword = password

                        coroutineScope.launch {
                            try {
                                if (urlChanged) {
                                    // URL 변경 시 임시 클라이언트로 인증 검증 후 앱 재시작
                                    val tempClient = createSupabaseClient(
                                        supabaseUrl = urlToUse,
                                        supabaseKey = BuildConfig.SUPABASE_KEY
                                    ) {
                                        defaultSerializer = KotlinXSerializer(Json {
                                            ignoreUnknownKeys = true
                                            encodeDefaults = true
                                        })
                                        install(Auth)
                                    }

                                    tempClient.auth.signInWith(Email) {
                                        this.email = enteredEmail
                                        this.password = enteredPassword
                                    }

                                    // 인증 성공 — URL 및 자격증명 저장 후 앱 재시작
                                    appPreferences.supabaseUrl = serverUrl
                                    appPreferences.appMode = AppMode.CLOUD
                                    if (rememberLogin) {
                                        appPreferences.saveLoginCredentials(email, password)
                                    } else {
                                        appPreferences.clearLoginCredentials()
                                    }

                                    Toast.makeText(context, "서버 연결 성공. 앱을 재시작합니다.", Toast.LENGTH_SHORT).show()

                                    val activity = context as Activity
                                    val intent = context.packageManager
                                        .getLaunchIntentForPackage(context.packageName)!!
                                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                                    context.startActivity(intent)
                                    activity.finishAffinity()
                                    exitProcess(0)
                                } else {
                                    // URL 동일 — 기존 싱글턴 AuthManager 사용
                                    val result = authManager.signInWithEmail(email, password)
                                    isLoading = false

                                    result.fold(
                                        onSuccess = {
                                            appPreferences.supabaseUrl = serverUrl
                                            if (rememberLogin) {
                                                appPreferences.saveLoginCredentials(email, password)
                                            } else {
                                                appPreferences.clearLoginCredentials()
                                            }
                                            Toast.makeText(context, "로그인 성공", Toast.LENGTH_SHORT).show()
                                            onLoginSuccess()
                                        },
                                        onFailure = { e ->
                                            Toast.makeText(context, e.message, Toast.LENGTH_LONG).show()
                                        }
                                    )
                                }
                            } catch (e: Exception) {
                                isLoading = false
                                val message = when {
                                    e.message?.contains("Unable to resolve host") == true ->
                                        "서버에 연결할 수 없습니다. 주소를 확인하세요."
                                    e.message?.contains("Invalid login credentials") == true ->
                                        "이메일 또는 비밀번호가 올바르지 않습니다"
                                    else -> e.message ?: "로그인에 실패했습니다"
                                }
                                Toast.makeText(context, message, Toast.LENGTH_LONG).show()
                            }
                        }
                    }

                    LoginMode.SIGN_UP -> {
                        if (password.length < 6) {
                            passwordError = "비밀번호는 6자 이상이어야 합니다"
                            return@ActionButton
                        }
                        if (password != confirmPassword) {
                            passwordError = "비밀번호가 일치하지 않습니다"
                            return@ActionButton
                        }

                        isLoading = true
                        val urlToUse = serverUrl.ifBlank { BuildConfig.SUPABASE_URL }
                        val urlChanged = urlToUse != appPreferences.supabaseUrl
                        val enteredEmail = email
                        val enteredPassword = password

                        coroutineScope.launch {
                            try {
                                if (urlChanged) {
                                    val tempClient = createSupabaseClient(
                                        supabaseUrl = urlToUse,
                                        supabaseKey = BuildConfig.SUPABASE_KEY
                                    ) {
                                        defaultSerializer = KotlinXSerializer(Json {
                                            ignoreUnknownKeys = true
                                            encodeDefaults = true
                                        })
                                        install(Auth)
                                    }
                                    tempClient.auth.signUpWith(Email) {
                                        this.email = enteredEmail
                                        this.password = enteredPassword
                                    }

                                    appPreferences.supabaseUrl = serverUrl
                                    appPreferences.appMode = AppMode.CLOUD
                                    if (rememberLogin) {
                                        appPreferences.saveLoginCredentials(email, password)
                                    } else {
                                        appPreferences.clearLoginCredentials()
                                    }

                                    Toast.makeText(context, "회원가입 성공. 앱을 재시작합니다.", Toast.LENGTH_SHORT).show()

                                    val activity = context as Activity
                                    val intent = context.packageManager
                                        .getLaunchIntentForPackage(context.packageName)!!
                                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                                    context.startActivity(intent)
                                    activity.finishAffinity()
                                    exitProcess(0)
                                } else {
                                    val result = authManager.signUpWithEmail(email, password)
                                    isLoading = false

                                    result.fold(
                                        onSuccess = {
                                            appPreferences.supabaseUrl = serverUrl
                                            if (rememberLogin) {
                                                appPreferences.saveLoginCredentials(email, password)
                                            } else {
                                                appPreferences.clearLoginCredentials()
                                            }
                                            Toast.makeText(context, "회원가입 성공", Toast.LENGTH_SHORT).show()
                                            onLoginSuccess()
                                        },
                                        onFailure = { e ->
                                            Toast.makeText(context, e.message, Toast.LENGTH_LONG).show()
                                        }
                                    )
                                }
                            } catch (e: Exception) {
                                isLoading = false
                                val message = when {
                                    e.message?.contains("Unable to resolve host") == true ->
                                        "서버에 연결할 수 없습니다. 주소를 확인하세요."
                                    else -> e.message ?: "회원가입에 실패했습니다"
                                }
                                Toast.makeText(context, message, Toast.LENGTH_LONG).show()
                            }
                        }
                    }

                    LoginMode.RESET_PASSWORD -> {
                        isLoading = true
                        coroutineScope.launch {
                            val result = authManager.sendPasswordResetEmail(email)
                            isLoading = false

                            result.fold(
                                onSuccess = {
                                    Toast.makeText(context, "비밀번호 재설정 이메일을 전송했습니다", Toast.LENGTH_SHORT).show()
                                    loginMode = LoginMode.SIGN_IN
                                },
                                onFailure = { e ->
                                    emailError = e.message
                                }
                            )
                        }
                    }
                }
            }
        )

        Spacer(modifier = Modifier.height(16.dp))

        // 하단 링크들
        when (loginMode) {
            LoginMode.SIGN_IN -> {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    TextButton(onClick = {
                        loginMode = LoginMode.RESET_PASSWORD
                        password = ""
                        passwordError = null
                    }) {
                        Text("비밀번호 찾기")
                    }

                    TextButton(onClick = {
                        loginMode = LoginMode.SIGN_UP
                        password = ""
                        confirmPassword = ""
                        passwordError = null
                    }) {
                        Text("회원가입")
                    }
                }
            }

            LoginMode.SIGN_UP, LoginMode.RESET_PASSWORD -> {
                TextButton(onClick = {
                    loginMode = LoginMode.SIGN_IN
                    password = ""
                    confirmPassword = ""
                    passwordError = null
                }) {
                    Text("로그인으로 돌아가기")
                }
            }
        }

        Spacer(modifier = Modifier.height(32.dp))
    }
}

private fun isValidEmail(email: String): Boolean {
    return android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()
}

@Composable
private fun ActionButton(
    text: String,
    isLoading: Boolean,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .height(56.dp)
            .clickable(enabled = !isLoading, onClick = onClick),
        shape = RoundedCornerShape(28.dp),
        color = MaterialTheme.colorScheme.primary
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.onPrimary
                )
            } else {
                Text(
                    text = text,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onPrimary
                )
            }
        }
    }
}

