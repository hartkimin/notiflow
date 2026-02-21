# AI Inline Analysis in Notification Detail

**Date**: 2026-02-21
**Scope**: Mobile app — MessageDetailScreen에 로컬 AI 분석 기능 추가

## Goal

타임라인 탭의 알림 상세 화면에서 해당 메시지를 온디바이스 Gemma 모델로 분석하는 기능을 추가한다. 사용자가 수동으로 AI 버튼을 눌러 분석을 트리거하고, 결과를 댓글로 저장할 수 있다.

## Approach

접근 A 선택: 기존 `MessageViewModel`에 AI 분석 로직을 직접 추가. 별도 ViewModel 생성 불필요.

## UI Layout

메시지 내용 카드 아래, 상태 섹션 위에 AI 분석 섹션 배치.

```
┌─────────────────────────────┐
│  헤더 카드 (앱, 발신자)      │
├─────────────────────────────┤
│  메시지 내용 카드            │
├─────────────────────────────┤
│  ┌─ AI 분석 ─────────────┐  │
│  │ [프리셋 드롭다운 ▼]   │  │
│  │ [AI 분석] 버튼        │  │
│  │ (스트리밍 결과)        │  │
│  │ [댓글로 저장] [지우기] │  │
│  └───────────────────────┘  │
├─────────────────────────────┤
│  상태 섹션 / 댓글 섹션      │
└─────────────────────────────┘
```

### State Transitions

| State | UI |
|-------|-----|
| 모델 미다운로드 | 버튼 클릭 → 안내 다이얼로그 + AI챗 이동 버튼 |
| Idle | 프리셋 드롭다운 + "AI 분석" 버튼 |
| Analyzing | 로딩 인디케이터 + 스트리밍 텍스트 |
| Completed | 결과 텍스트 + "댓글로 저장" / "지우기" |
| Error | 에러 메시지 + 재시도 버튼 |

## Data Flow

```
AI 분석 버튼 클릭
  → MessageViewModel.analyzeWithAi(content, image?)
    → 프롬프트 조립 (Gemma turn format)
    → AiMessageClassifier.generate(modelSize, prompt, image, onPartialResult)
      → onPartialResult → _aiStreamingText 업데이트
    → 완료 → AiAnalysisState.Completed(result)
  → "댓글로 저장" 클릭
    → addComment("[AI] {preset}: {result}")
```

## ViewModel Changes (MessageViewModel)

### New State

```kotlin
sealed class AiAnalysisState {
    object Idle : AiAnalysisState()
    object ModelNotReady : AiAnalysisState()
    object Analyzing : AiAnalysisState()
    data class Completed(val result: String) : AiAnalysisState()
    data class Error(val message: String) : AiAnalysisState()
}
```

### New StateFlows

- `aiAnalysisState: StateFlow<AiAnalysisState>`
- `aiStreamingText: StateFlow<String>`
- `selectedPreset: StateFlow<PromptPreset?>`
- `modelSize: StateFlow<GemmaModelSize>`
- `isModelDownloaded: StateFlow<Boolean>`

### New Methods

- `analyzeWithAi(content: String, attachedImage: Bitmap? = null)`
- `saveAnalysisAsComment(messageId: String)`
- `clearAnalysis()`
- `selectPreset(preset: PromptPreset?)`

### New Dependencies (Hilt)

- `AiMessageClassifier`
- `AiModelManager`

## Prompt Strategy

Gemma turn format 사용:

```
<start_of_turn>user
{preset instruction}

메시지:
{message content}
<end_of_turn>
<start_of_turn>model
```

### Default Presets

- 요약: "이 알림 메시지의 핵심 내용을 간단히 요약해줘"
- 분석: "이 메시지의 의도, 긴급도, 필요한 액션을 분석해줘"
- 번역: "이 메시지를 영어로 번역해줘"
- 자유 입력: 사용자 직접 작성

기존 `PromptPresetStore` 재사용.

## Comment Storage Format

```
[AI] {프리셋이름}: {분석 결과 텍스트}
```

기존 `comment` JSON 필드의 댓글 배열에 추가.

## Out of Scope

- 자동 분석 트리거
- 클라우드 AI 프로바이더 연동
- 분석 기반 자동 카테고리 분류
- 배치 분석 (여러 메시지)
