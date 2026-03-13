# NotiFlow — Gemma 3n → Qwen3.5-4B Multimodal 마이그레이션 계획서

본 문서는 NotiFlow 앱의 온디바이스 LLM 엔진을 MediaPipe(Gemma)에서 LiteRT-LM(Qwen3.5)으로 전환하기 위한 상세 가이드입니다.

---

## 📋 마이그레이션 프롬프트 (전체 복사)

```markdown
## 역할
너는 Android 온디바이스 LLM 마이그레이션 전문가야.
NotiFlow 앱의 LLM 추론 엔진을 Gemma 3n (MediaPipe .task) 에서
Qwen3.5-4B Multimodal (LiteRT-LM .litertlm) 로 교체해줘.

---

## 현재 환경 (AS-IS)

- **프로젝트 패키지**: `com.hart.notimgmt`
- **AI 패키지**: `com.hart.notimgmt.ai`
- **모델**: Gemma 3n E4B (.task)
- **API**: MediaPipe LLM Inference API (`com.google.mediapipe:tasks-genai`)
- **기존 클래스**: `AiMessageClassifier`, `AiModelManager`, `ModelDownloadWorker`
- **추론방식**: `LlmInference.createFromOptions()` + `generateResponseAsync()` 콜백

---

## 목표 환경 (TO-BE)

- **모델**: Qwen3.5-4B Multimodal
- **포맷**: LiteRT-LM .litertlm 파일
  - 파일명: `model_multimodal.litertlm` (5.25 GB)
  - 출처: `https://huggingface.co/litert-community/Qwen3.5-4B-LiteRT`
- **API**: LiteRT-LM Kotlin API (`com.google.ai.edge.litertlm:litertlm-android`)
- **추론방식**: Engine + Conversation + `sendMessageAsync()` Flow 기반
- **Thinking 모드**: 비활성화 (`/no_think` 시스템 프롬프트)

---

## 작업 범위

### 1. 의존성 및 설정 변경 (`app/build.gradle.kts` & `libs.versions.toml`)

- `libs.versions.toml`에 `litertlm` 관련 라이브러리 정의 추가.
- `app/build.gradle.kts`에서 `mediapipe` 의존성 제거 및 아래 내용 추가:

```kotlin
// 제거
implementation(libs.mediapipe.tasks.genai)
implementation(libs.mediapipe.tasks.vision)

// 추가
implementation("com.google.ai.edge.litertlm:litertlm-android:latest.release")
implementation("com.squareup.okhttp3:okhttp:4.12.0")          // 모델 다운로드
implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3") // JSON 파싱
```

`android { defaultConfig { } }` 블록 내 HuggingFace 토큰 설정 추가 (기존 `local.properties` 활용):

```kotlin
val localProps = java.util.Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) load(file.inputStream())
}
buildConfigField(
    "String",
    "HUGGING_FACE_TOKEN",
    "\"${localProps.getProperty("huggingface.token", "")}\""
)
```

---

### 2. `ModelManager.kt` 신규 생성 (`com.hart.notimgmt.ai`)

- **역할**: 모델 파일 다운로드 및 로컬 저장 관리
- **저장 위치**: `context.filesDir / "qwen3.5_4b_multimodal.litertlm"`
- **HuggingFace 인증**: `BuildConfig.HUGGING_FACE_TOKEN` 사용
- **기능**:
  - `isModelDownloaded(): Boolean`
  - `downloadModel(onProgress: (Float, Long, Long) -> Unit): Result<Unit>` (OkHttp 기반, 원자적 저장)
  - `getModelPath(): String`
  - `deleteModel()`

---

### 3. `PiiInferenceEngine.kt` 교체 (`com.hart.notimgmt.ai`)

기존 `AiMessageClassifier`를 대체하는 LiteRT-LM 기반 엔진:

- **시스템 프롬프트**: `/no_think` 포함, PII 탐지 전용 JSON 출력 지시.
- **초기화**: `Backend.GPU` 우선 사용, 실패 시 `CPU` 폴백.
- **기능**:
  - `detectTextPii(text: String): Flow<String>`
  - `detectImagePii(bitmap: Bitmap): Flow<String>` (멀티모달 처리)
  - `parseResult(rawFlow: Flow<String>): PiiScanResult` (Thinking 태그 제거 로직 포함)
- **리소스 관리**: `close()` 메서드로 Engine 및 Conversation 해제.

---

### 4. 데이터 클래스 정의 (`com.hart.notimgmt.data.model`)

```kotlin
@Serializable
data class PiiScanResult(
    val detected: Boolean,
    val items: List<PiiItem>,
    @SerialName("risk_level") val riskLevel: String
)

@Serializable
data class PiiItem(
    val type: String,
    val value: String,
    val start: Int = -1,
    val end: Int = -1
)
```

---

### 5. `ModelDownloadViewModel.kt` 생성 (`com.hart.notimgmt.viewmodel`)

- **상태 관리**: `Idle`, `Checking`, `Downloading`, `Downloaded`, `Error` 상태 정의.
- **동작**: 모델 유무 체크, 다운로드 시작/취소 로직 구현.

---

### 6. 기존 코드 정리

- `AiMessageClassifier.kt` 제거 또는 `PiiInferenceEngine`으로 리팩토링.
- `AiModelManager.kt`의 역할을 신규 `ModelManager`로 이전.
- `ModelDownloadWorker.kt` (WorkManager) 사용 여부 재검토 (LiteRT-LM의 큰 용량을 고려하여 직접 다운로드 방식 권장).

---

## 주의사항

1. **Thinking 제거**: Qwen3.5의 `<think>` 블록은 `parseResult()`에서 Regex로 반드시 제거해야 함.
2. **용량 관리**: 5.25GB의 대용량이므로 `getExternalFilesDir` 사용 고려 (내장 메모리 부족 방지).
3. **GPU 최적화**: GPU 사용 시 초기화 시간이 길 수 있으므로 스플래시 또는 별도 로딩 화면에서 처리.
4. **보안**: `local.properties`의 토큰이 절대 코드에 하드코딩되지 않도록 주의.

---

## 검증 항목

- [ ] `mediapipe` 라이브러리 참조 제거 확인
- [ ] 5GB 이상의 모델 파일 다운로드 및 무결성 확인
- [ ] 텍스트 및 이미지 입력에 대한 PII 탐지 JSON 출력 확인
- [ ] `<think>` 태그가 제거된 최종 결과물 확인
- [ ] GPU 가속 동작 여부 확인 (Logcat 모니터링)
```

---

## 🔧 보조 유틸리티: Thinking 제거 로직 (Kotlin)

```kotlin
fun stripThinking(input: String): String {
    val regex = Regex("<think>.*?</think>", RegexOption.DOT_MATCHES_ALL)
    return input.replace(regex, "").trim()
}
```
